import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h2 className="sidebar-title">MyApp</h2>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" end>Dashboard</NavLink>
          <NavLink to="/dashboard/team-members">Team Members</NavLink>
          <NavLink to="/dashboard/send-email">Send Email</NavLink>
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <span className="topbar-greeting">Welcome, {user?.username}</span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
