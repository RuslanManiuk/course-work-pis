from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator
from uuid import UUID

import chromadb
import httpx

from app.core.config import get_settings

settings = get_settings()

_OPENROUTER_BASE = "https://openrouter.ai/api/v1"
_GENERATION_MODEL = "nvidia/nemotron-nano-9b-v2:free"
_SYSTEM_PROMPT = """You are an AI assistant for hackathon judges on the HackFlow platform.
Your role is to help judges quickly understand and compare hackathon project submissions.
Answer questions concisely and factually based only on the provided project data.
If information is not in the provided context, say so — do not hallucinate."""


def _get_chroma_client() -> chromadb.HttpClient:
    return chromadb.HttpClient(host=settings.chroma_host, port=settings.chroma_port)


def _collection_name(hackathon_id: UUID) -> str:
    return f"hackathon_{str(hackathon_id).replace('-', '_')}"


def _or_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://hackflow.dev",
        "X-Title": "HackFlow",
    }


async def _chat(messages: list[dict], model: str = _GENERATION_MODEL) -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{_OPENROUTER_BASE}/chat/completions",
            headers=_or_headers(),
            json={"model": model, "messages": messages},
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


class RagService:
    def _embed(self, text: str) -> list[float]:
        from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
        ef = DefaultEmbeddingFunction()
        return list(ef([text])[0])

    async def index_submission(
        self,
        submission_id: UUID,
        hackathon_id: UUID,
        team_name: str,
        description: str,
        repository_url: str,
        skills: list[str] | None = None,
    ) -> None:
        """Embed submission and upsert into ChromaDB."""
        document = _build_document(team_name, description, repository_url, skills or [])
        embedding = await asyncio.get_event_loop().run_in_executor(None, self._embed, document)

        client = _get_chroma_client()
        collection = client.get_or_create_collection(
            name=_collection_name(hackathon_id),
            metadata={"hnsw:space": "cosine"},
        )
        collection.upsert(
            ids=[str(submission_id)],
            embeddings=[embedding],
            documents=[document],
            metadatas=[{
                "submission_id": str(submission_id),
                "team_name": team_name,
                "hackathon_id": str(hackathon_id),
            }],
        )

    async def query(
        self,
        hackathon_id: UUID,
        question: str,
        n_results: int = 5,
    ) -> AsyncGenerator[str, None]:
        """
        RAG query: embed question → retrieve top-k → stream OpenRouter response.
        Yields text chunks as an async generator (SSE-friendly).
        """
        question_embedding = await asyncio.get_event_loop().run_in_executor(
            None, self._embed, question
        )

        client = _get_chroma_client()
        try:
            collection = client.get_collection(_collection_name(hackathon_id))
        except Exception:
            yield "No submissions have been indexed for this hackathon yet."
            return

        results = collection.query(
            query_embeddings=[question_embedding],
            n_results=min(n_results, collection.count()),
            include=["documents", "metadatas"],
        )

        contexts = results.get("documents", [[]])[0]
        if not contexts:
            yield "No relevant submissions found."
            return

        prompt = _build_rag_prompt(question, contexts)
        messages = [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        async with httpx.AsyncClient(timeout=60.0) as http:
            async with http.stream(
                "POST",
                f"{_OPENROUTER_BASE}/chat/completions",
                headers=_or_headers(),
                json={"model": _GENERATION_MODEL, "messages": messages, "stream": True},
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data.strip() == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            delta = chunk["choices"][0]["delta"].get("content", "")
                            if delta:
                                yield delta
                        except (json.JSONDecodeError, KeyError, IndexError):
                            pass

    async def generate_criteria(
        self,
        hackathon_title: str,
        hackathon_description: str,
        n: int = 5,
    ) -> list[dict]:
        """
        Ask OpenRouter to suggest evaluation criteria for a hackathon.
        Returns a list of dicts: {name, description, weight, max_score}.
        """
        prompt = f"""You are an expert hackathon organizer.
Given the hackathon below, suggest exactly {n} distinct evaluation criteria.

Hackathon title: {hackathon_title}
Hackathon description: {hackathon_description}

Respond ONLY with valid JSON — a JSON array, no markdown, no code fences.
Each item must have these keys:
  "name"        (string, 3-60 chars)
  "description" (string, concise 1-sentence explanation)
  "weight"      (number, all weights must sum to 100)
  "max_score"   (integer, 10 or 100)

Example format:
[{{"name":"Technical Excellence","description":"Quality and complexity of the implementation.","weight":25,"max_score":10}}]
"""
        text = await _chat([{"role": "user", "content": prompt}])
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())

    async def evaluate_submission(
        self,
        submission_title: str,
        submission_description: str,
        repository_url: str,
        criteria: list[dict],
    ) -> list[dict]:
        """
        Ask OpenRouter to score a submission against given criteria.
        Returns list of {criteria_id, criteria_name, score, feedback}.
        """
        criteria_block = "\n".join(
            f'- id: {c["id"]}, name: "{c["name"]}", max_score: {c["max_score"]}'
            for c in criteria
        )
        prompt = f"""You are an impartial hackathon judge.
Evaluate the following submission against each criterion and provide a fair score and brief feedback.

## Submission
Title: {submission_title}
Description: {submission_description}
Repository: {repository_url}

## Evaluation Criteria
{criteria_block}

Respond ONLY with valid JSON — a JSON array, no markdown, no code fences.
Each item must have:
  "criteria_id"   (string, the id from the criterion)
  "criteria_name" (string)
  "score"         (integer, 1 to max_score inclusive)
  "feedback"      (string, 1-2 sentences explaining the score)
"""
        text = await _chat([{"role": "user", "content": prompt}])
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())


def _build_document(
    team_name: str,
    description: str,
    repository_url: str,
    skills: list[str],
) -> str:
    skills_str = ", ".join(skills) if skills else "Not specified"
    return f"""# Team: {team_name}

## Tech Stack & Skills
{skills_str}

## Repository
{repository_url}

## Project Description
{description}
"""


def _build_rag_prompt(question: str, contexts: list[str]) -> str:
    context_block = "\n\n---\n\n".join(contexts)
    return f"""## Hackathon Projects Data

{context_block}

---

## Judge's Question

{question}

## Answer"""


rag_service = RagService()
