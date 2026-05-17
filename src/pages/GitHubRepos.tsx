import { useEffect, useState } from "react";
import { useTeamMembers } from "../context/TeamMembersContext";

interface Repo {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  forks_count: number;
}

interface MemberRepos {
  name: string;
  email: string;
  github: string;
  repos: Repo[];
  error?: string;
}

export default function GitHubRepos() {
  const { members } = useTeamMembers();
  const [data, setData] = useState<MemberRepos[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const membersWithGithub = members.filter((m) => m.github?.trim());

    if (membersWithGithub.length === 0) {
      setData([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all(
      membersWithGithub.map(async (m) => {
        const username = m.github!.trim();
        try {
          const res = await fetch(
            `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`
          );
          if (!res.ok) {
            const msg =
              res.status === 403
                ? "Rate limited. Try again later."
                : res.status === 404
                  ? `User "${username}" not found`
                  : `Error ${res.status}`;
            return { name: m.name, email: m.email, github: username, repos: [], error: msg };
          }
          const repos: Repo[] = await res.json();
          return { name: m.name, email: m.email, github: username, repos, error: undefined };
        } catch {
          return { name: m.name, email: m.email, github: username, repos: [], error: "Network error" };
        }
      })
    ).then((results) => {
      if (!cancelled) {
        setData(results);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [members]);

  const totalRepos = data.reduce((sum, d) => sum + d.repos.length, 0);

  return (
    <div>
      <h1>GitHub Repos</h1>

      {members.filter((m) => m.github?.trim()).length === 0 ? (
        <p className="empty-state">
          No members have a GitHub username set.{" "}
          <a href="/dashboard/team-members">Add GitHub usernames first.</a>
        </p>
      ) : loading ? (
        <p className="empty-state">Loading repos...</p>
      ) : (
        <>
          <p className="repos-summary">{totalRepos} repo{totalRepos !== 1 ? "s" : ""} across {data.length} member{data.length !== 1 ? "s" : ""}</p>

          {data.map((d) => (
            <section key={d.github} className="member-repos">
              <h2>
                {d.name}
                <span className="member-github-tag">@{d.github}</span>
              </h2>

              {d.error ? (
                <p className="error">{d.error}</p>
              ) : d.repos.length === 0 ? (
                <p className="empty-state">No public repos.</p>
              ) : (
                <div className="repo-grid">
                  {d.repos.map((r) => (
                    <a
                      key={r.id}
                      href={r.html_url}
                      target="_blank"
                      className="repo-card"
                    >
                      <div className="repo-name">{r.name}</div>
                      {r.description && (
                        <div className="repo-desc">{r.description}</div>
                      )}
                      <div className="repo-meta">
                        {r.language && <span>{r.language}</span>}
                        <span>★ {r.stargazers_count}</span>
                        <span>⑂ {r.forks_count}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
