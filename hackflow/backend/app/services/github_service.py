from __future__ import annotations

import re
from datetime import datetime, timezone
from uuid import UUID

import httpx

from app.core.config import get_settings
from app.db.models.github_stats import GithubStats

settings = get_settings()

GITHUB_API_BASE = "https://api.github.com"
CACHE_TTL_HOURS = 24

# Regex to extract owner/repo from a GitHub URL
_GITHUB_REPO_RE = re.compile(
    r"https?://github\.com/([^/]+)/([^/?\s#]+?)(?:\.git)?(?:[/?#].*)?$"
)


class GithubService:
    """GitHub REST API v3 client for user stats."""

    async def fetch_user_stats(self, access_token: str) -> dict:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            user_resp = await client.get(f"{GITHUB_API_BASE}/user", headers=headers)
            user_resp.raise_for_status()
            user_data = user_resp.json()

            repos_resp = await client.get(
                f"{GITHUB_API_BASE}/user/repos?per_page=100&sort=updated",
                headers=headers,
            )
            repos_resp.raise_for_status()
            repos = repos_resp.json()

        language_counts: dict[str, int] = {}
        for repo in repos:
            lang = repo.get("language")
            if lang:
                language_counts[lang] = language_counts.get(lang, 0) + 1

        total_repos = len(repos)
        language_breakdown = [
            {"language": lang, "percentage": round(count / total_repos * 100, 1)}
            for lang, count in sorted(language_counts.items(), key=lambda x: x[1], reverse=True)
        ] if total_repos > 0 else []

        return {
            "repositories": user_data.get("public_repos", 0),
            "followers": user_data.get("followers", 0),
            "total_contributions": user_data.get("public_repos", 0),  # Approximate
            "language_breakdown": language_breakdown,
        }

    def is_cache_valid(self, stats: GithubStats) -> bool:
        age_hours = (datetime.now(timezone.utc) - stats.cached_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600
        return age_hours < CACHE_TTL_HOURS

    async def exchange_code_for_token(self, code: str) -> dict:
        """Exchange GitHub OAuth code for access token."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://github.com/login/oauth/access_token",
                json={
                    "client_id": settings.github_client_id,
                    "client_secret": settings.github_client_secret,
                    "code": code,
                    "redirect_uri": settings.github_redirect_uri,
                },
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            return response.json()

    async def get_github_user(self, access_token: str) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                },
            )
            response.raise_for_status()
            return response.json()

    def parse_repo_url(self, url: str) -> tuple[str, str] | None:
        """Return (owner, repo) from a github.com URL, or None if invalid."""
        m = _GITHUB_REPO_RE.match(url.strip())
        if not m:
            return None
        return m.group(1), m.group(2)

    async def check_repo_access(self, repo_url: str) -> bool:
        """
        Try to fetch the repo using the service-account bot token.
        Returns True if the repo is accessible (public or bot is collaborator).
        Returns False if 404 (private repo, no access).
        Raises httpx.HTTPStatusError for unexpected errors.
        """
        parsed = self.parse_repo_url(repo_url)
        if not parsed:
            raise ValueError(f"Invalid GitHub repository URL: {repo_url}")

        owner, repo = parsed
        token = settings.github_bot_token
        headers: dict[str, str] = {"Accept": "application/vnd.github+json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{repo}",
                headers=headers,
            )
            if response.status_code == 404:
                return False
            response.raise_for_status()
            return True

    async def fetch_repo_stats(self, repo_url: str) -> dict:
        """
        Fetch public stats for a GitHub repository.
        Works for public repos without any auth token.
        Returns dict with stars, forks, open_issues, language, topics,
        default_branch, commit_count, contributors_count, last_pushed_at.
        """
        parsed = self.parse_repo_url(repo_url)
        if not parsed:
            raise ValueError(f"Invalid GitHub repository URL: {repo_url}")

        owner, repo = parsed
        token = settings.github_bot_token
        headers: dict[str, str] = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"

        async with httpx.AsyncClient(timeout=20.0) as client:
            repo_resp = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{repo}", headers=headers
            )
            if repo_resp.status_code == 404:
                raise ValueError("Repository not found or is private")
            repo_resp.raise_for_status()
            repo_data = repo_resp.json()

            # Run remaining requests concurrently
            import asyncio

            async def _get(url: str) -> httpx.Response:
                return await client.get(url, headers=headers)

            contrib_task = asyncio.create_task(
                _get(f"{GITHUB_API_BASE}/repos/{owner}/{repo}/contributors?per_page=100&anon=1")
            )
            commits_task = asyncio.create_task(
                _get(f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits?per_page=1")
            )
            recent_commits_task = asyncio.create_task(
                _get(f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits?per_page=10")
            )
            languages_task = asyncio.create_task(
                _get(f"{GITHUB_API_BASE}/repos/{owner}/{repo}/languages")
            )
            releases_task = asyncio.create_task(
                _get(f"{GITHUB_API_BASE}/repos/{owner}/{repo}/releases?per_page=5")
            )

            contrib_resp, commits_resp, recent_commits_resp, languages_resp, releases_resp = await asyncio.gather(
                contrib_task, commits_task, recent_commits_task, languages_task, releases_task
            )

            # Contributor count
            contributors_count = len(contrib_resp.json()) if contrib_resp.status_code == 200 else 0

            # Contributor details (name + avatar, top 10)
            contributors: list[dict] = []
            if contrib_resp.status_code == 200:
                for c in contrib_resp.json()[:10]:
                    contributors.append({
                        "login": c.get("login", "anon"),
                        "avatar_url": c.get("avatar_url"),
                        "contributions": c.get("contributions", 0),
                        "html_url": c.get("html_url"),
                    })

            # Total commit count
            commit_count = 0
            if commits_resp.status_code == 200:
                link_header = commits_resp.headers.get("link", "")
                if 'rel="last"' in link_header:
                    import re as _re
                    m = _re.search(r'page=(\d+)>;\s*rel="last"', link_header)
                    commit_count = int(m.group(1)) if m else 1
                elif recent_commits_resp.status_code == 200:
                    commit_count = len(recent_commits_resp.json())

            # Recent commits list
            recent_commits: list[dict] = []
            if recent_commits_resp.status_code == 200:
                for c in recent_commits_resp.json():
                    commit_obj = c.get("commit", {})
                    author = commit_obj.get("author", {})
                    gh_author = c.get("author") or {}
                    recent_commits.append({
                        "sha": c.get("sha", "")[:7],
                        "message": commit_obj.get("message", "").split("\n")[0][:80],
                        "author_name": author.get("name", "Unknown"),
                        "author_avatar": gh_author.get("avatar_url"),
                        "date": author.get("date"),
                        "url": c.get("html_url"),
                    })

            # Language breakdown (bytes → percentages)
            languages_breakdown: list[dict] = []
            if languages_resp.status_code == 200:
                lang_bytes: dict[str, int] = languages_resp.json()
                total_bytes = sum(lang_bytes.values()) or 1
                languages_breakdown = [
                    {
                        "language": lang,
                        "bytes": b,
                        "percentage": round(b / total_bytes * 100, 1),
                    }
                    for lang, b in sorted(lang_bytes.items(), key=lambda x: x[1], reverse=True)
                ]

            # Releases
            releases: list[dict] = []
            if releases_resp.status_code == 200:
                for r in releases_resp.json():
                    releases.append({
                        "tag": r.get("tag_name"),
                        "name": r.get("name") or r.get("tag_name"),
                        "published_at": r.get("published_at"),
                        "url": r.get("html_url"),
                        "prerelease": r.get("prerelease", False),
                    })

        return {
            "owner": owner,
            "repo": repo,
            "full_name": repo_data.get("full_name", f"{owner}/{repo}"),
            "html_url": repo_data.get("html_url", f"https://github.com/{owner}/{repo}"),
            "description": repo_data.get("description"),
            "stars": repo_data.get("stargazers_count", 0),
            "watchers": repo_data.get("watchers_count", 0),
            "forks": repo_data.get("forks_count", 0),
            "open_issues": repo_data.get("open_issues_count", 0),
            "language": repo_data.get("language"),
            "topics": repo_data.get("topics", []),
            "default_branch": repo_data.get("default_branch", "main"),
            "license": repo_data.get("license", {}).get("spdx_id") if repo_data.get("license") else None,
            "commit_count": commit_count,
            "contributors_count": contributors_count,
            "contributors": contributors,
            "recent_commits": recent_commits,
            "languages_breakdown": languages_breakdown,
            "releases": releases,
            "last_pushed_at": repo_data.get("pushed_at"),
            "created_at": repo_data.get("created_at"),
            "size_kb": repo_data.get("size", 0),
            "visibility": repo_data.get("visibility", "public"),
        }


github_service = GithubService()
