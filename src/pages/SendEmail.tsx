import { useState } from "react";
import { useTeamMembers } from "../context/TeamMembersContext";

const SENDER_EMAIL = "aaditya.aggarwal@brillio.com";

interface SentRecord {
  to: string[];
  subject: string;
  body: string;
  timestamp: string;
}

export default function SendEmail() {
  const { members } = useTeamMembers();
  const [selected, setSelected] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState<SentRecord[]>([]);

  const toggle = (email: string) => {
    setSelected((prev) =>
      prev.includes(email)
        ? prev.filter((e) => e !== email)
        : [...prev, email]
    );
  };

  const buildMailTo = () => {
    const to = selected.join(";");
    const params = new URLSearchParams();
    if (subject.trim()) params.set("subject", subject.trim());
    if (body.trim()) params.set("body", body.trim());
    const qs = params.toString();
    return `mailto:${to}${qs ? `?${qs}` : ""}`;
  };

  const handleSend = () => {
    if (selected.length === 0 || !body.trim()) return;

    window.location.href = buildMailTo();

    setSent([
      {
        to: [...selected],
        subject: subject.trim() || "(no subject)",
        body: body.trim(),
        timestamp: new Date().toLocaleString(),
      },
      ...sent,
    ]);

    setSelected([]);
    setSubject("");
    setBody("");
  };

  return (
    <div>
      <h1>Send Email</h1>

      <div className="email-compose">
        <div className="card">
          <h2>New Email</h2>

          <div className="compose-field">
            <label>From</label>
            <input value={SENDER_EMAIL} disabled />
          </div>

          <div className="compose-field">
            <label>To</label>
            {members.length === 0 ? (
              <p className="empty-state">
                No team members added.{" "}
                <a href="/dashboard/team-members">Add some first.</a>
              </p>
            ) : (
              <div className="recipients-list">
                {members.map((m) => {
                  const checked = selected.includes(m.email);
                  return (
                    <label
                      key={m.email}
                      className={`recipient-chip ${checked ? "checked" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(m.email)}
                      />
                      <span className="recipient-name">{m.name}</span>
                      <span className="recipient-email">{m.email}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="compose-field">
            <label>Subject</label>
            <input
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="compose-field">
            <label>Message</label>
            <textarea
              placeholder="Type your message here..."
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <button
            className="send-btn"
            onClick={handleSend}
            disabled={selected.length === 0 || !body.trim()}
          >
            Send Email
          </button>
        </div>
      </div>

      {sent.length > 0 && (
        <div className="sent-history">
          <h2>Sent Emails</h2>
          {sent.map((msg, i) => (
            <div key={i} className="sent-card">
              <div className="sent-header">
                <strong>To:</strong> {msg.to.join(", ")}
                <span className="sent-time">{msg.timestamp}</span>
              </div>
              <div className="sent-subject">{msg.subject}</div>
              <div className="sent-body">{msg.body}</div>
              <div className="sent-from">From: {SENDER_EMAIL}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
