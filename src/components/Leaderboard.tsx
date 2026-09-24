import type { LeaderboardEntry } from "@/types";

export function Leaderboard({ entries, highlightId }: { entries: LeaderboardEntry[]; highlightId?: string }) {
  return (
    <ol className="board">
      {entries.map((e) => (
        <li
          key={e.player_id}
          className={`${e.rank <= 3 ? `top${e.rank}` : ""}${e.player_id === highlightId ? " me" : ""}`}
        >
          <span className="rank">{e.rank}</span>
          <span className="who">{e.nickname}</span>
          <span className="score">{e.score}</span>
        </li>
      ))}
    </ol>
  );
}
