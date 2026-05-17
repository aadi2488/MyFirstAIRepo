import { useState } from "react";
import { useTeamMembers } from "../context/TeamMembersContext";

export default function TeamMembers() {
  const { members, addMember, removeMember } = useTeamMembers();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    addMember(name.trim(), email.trim());
    setName("");
    setEmail("");
  };

  return (
    <div>
      <h1>Team Members</h1>

      <form className="member-form" onSubmit={handleAdd}>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit">Add Member</button>
      </form>

      {members.length === 0 ? (
        <p className="empty-state">No team members yet. Add one above.</p>
      ) : (
        <div className="member-list">
          {members.map((m, i) => (
            <div key={i} className="member-row">
              <div>
                <span className="member-name">{m.name}</span>
                <span className="member-email">{m.email}</span>
              </div>
              <button className="remove-btn" onClick={() => removeMember(i)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
