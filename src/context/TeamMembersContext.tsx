import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

const STORAGE_KEY = "team-members";

export interface Member {
  name: string;
  email: string;
}

interface TeamMembersContextType {
  members: Member[];
  addMember: (name: string, email: string) => void;
  removeMember: (index: number) => void;
}

const TeamMembersContext = createContext<TeamMembersContextType | null>(null);

function loadMembers(): Member[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMembers(members: Member[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

export function TeamMembersProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>(loadMembers);

  useEffect(() => {
    saveMembers(members);
  }, [members]);

  const addMember = (name: string, email: string) => {
    setMembers([...members, { name, email }]);
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  return (
    <TeamMembersContext.Provider value={{ members, addMember, removeMember }}>
      {children}
    </TeamMembersContext.Provider>
  );
}

export function useTeamMembers() {
  const ctx = useContext(TeamMembersContext);
  if (!ctx) throw new Error("useTeamMembers must be used within TeamMembersProvider");
  return ctx;
}
