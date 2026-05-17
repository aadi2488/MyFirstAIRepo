import { Link } from "react-router-dom";

const stats = [
  { label: "Total Users", value: "1,284" },
  { label: "Active Sessions", value: "342" },
  { label: "Revenue", value: "$48,290" },
  { label: "New Signups", value: "89" },
];

export default function Dashboard() {
  return (
    <div>
      <div className="section-header">
        <h1>Dashboard</h1>
        <Link to="/dashboard/team-members" className="btn-link">
          Manage Team
        </Link>
      </div>

      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Recent Activity</h2>
        <table className="activity-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Action</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>alice</td><td>Created invoice #1024</td><td>2 min ago</td></tr>
            <tr><td>bob</td><td>Updated profile</td><td>15 min ago</td></tr>
            <tr><td>carol</td><td>Deployed build v3.2</td><td>1 hr ago</td></tr>
            <tr><td>dave</td><td>Added API key</td><td>3 hr ago</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
