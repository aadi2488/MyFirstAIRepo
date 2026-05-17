import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TeamMembers from "./pages/TeamMembers";
import SendEmail from "./pages/SendEmail";
import GitHubRepos from "./pages/GitHubRepos";
import ImageValidator from "./pages/ImageValidator";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/team-members" element={<TeamMembers />} />
        <Route path="/dashboard/send-email" element={<SendEmail />} />
        <Route path="/dashboard/github-repos" element={<GitHubRepos />} />
        <Route path="/dashboard/image-validator" element={<ImageValidator />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
