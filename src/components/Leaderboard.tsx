import type { LeaderboardEntry } from "@/types";

export function Leaderboard({ entries, highlightId }: { entries: LeaderboardEntry[]; highlightId?: string }) {
  return (
    <ol style={{ listStyle: "none", padding: 0 }}>
      {entries.map((e) => (
        <li key={e.player_id}
          style={{
            display: "flex", justifyContent: "space-between", padding: "10px 14px",
            marginBottom: 6, borderRadius: 8,
            background: e.player_id === highlightId ? "var(--blue)" : "#2a2b47",
          }}>
          <span>{e.rank}. {e.nickname}</span>
          <span>{e.score}</span>
        </li>
      ))}
    </ol>
  );
}
