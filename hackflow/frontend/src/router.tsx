import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useParams,
} from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

// Layouts
import AppLayout from '@/components/layout/AppLayout';

// Auth pages
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import GitHubCallbackPage from '@/pages/auth/GitHubCallbackPage';

// App pages
import DashboardPage from '@/pages/dashboard/DashboardPage';
import WorkspacePage from '@/pages/workspace/WorkspacePage';
import HelpdeskPage from '@/pages/helpdesk/HelpdeskPage';
import JudgingPage from '@/pages/judging/JudgingPage';
import TeamsPage from '@/pages/teams/TeamsPage';
import MatchmakingPage from '@/pages/teams/MatchmakingPage';
import HackathonsListPage from '@/pages/hackathons/HackathonsListPage';
import HackathonDetailPage from '@/pages/hackathons/HackathonDetailPage';
import AdminPage from '@/pages/admin/AdminPage';
import ProfilePage from '@/pages/profile/ProfilePage';
import JudgingLandingPage from '@/pages/judging/JudgingLandingPage';

function RequireAuth() {
  const { accessToken } = useAuthStore();
  if (!accessToken) return <Navigate to="/auth/login" replace />;
  return <Outlet />;
}

function WorkspacePageWrapper() {
  const { teamId = '' } = useParams<{ teamId: string }>();
  return <WorkspacePage teamId={teamId} />;
}

const router = createBrowserRouter([
  // Public auth routes
  { path: '/auth/login', element: <LoginPage /> },
  { path: '/auth/register', element: <RegisterPage /> },
  { path: '/auth/github/callback', element: <GitHubCallbackPage /> },

  // Protected app routes
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/hackathons', element: <HackathonsListPage /> },
          { path: '/hackathons/:hackathonId', element: <HackathonDetailPage /> },
          { path: '/teams', element: <TeamsPage /> },
          { path: '/teams/:teamId/matchmaking', element: <MatchmakingPage /> },
          { path: '/workspace/:teamId', element: <WorkspacePageWrapper /> },
          { path: '/helpdesk', element: <HelpdeskPage /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '/judging/:hackathonId', element: <JudgingPage /> },
          { path: '/judging', element: <JudgingLandingPage /> },
          { path: '/admin', element: <AdminPage /> },
        ],
      },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}

