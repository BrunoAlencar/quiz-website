"use client";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socketClient";

function JoinInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase());
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");

  function join(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const socket = getSocket();
    socket.emit("player:join", { joinCode: code.toUpperCase(), nickname }, (res) => {
      if ("error" in res) { setError(res.error); return; }
      sessionStorage.setItem("playerId", res.playerId);
      sessionStorage.setItem("gameId", res.gameId);
      sessionStorage.setItem("nickname", res.nickname);
      router.push("/play");
    });
  }

  return (
    <main className="screen screen--narrow">
      <div className="stack">
        <div className="shapes small" aria-hidden="true">
          <i className="s0">▲</i><i className="s1">◆</i><i className="s2">●</i><i className="s3">■</i>
        </div>
        <h1>Join the game</h1>
        <p className="tagline">Enter the code shown on the host&rsquo;s screen.</p>
      </div>

      <form onSubmit={join} className="card stack">
        <label className="field">
          <span>Game code</span>
          <input
            placeholder="ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            autoFocus
            style={{ textTransform: "uppercase", letterSpacing: "0.3em", fontSize: "1.4rem", fontWeight: 700, textAlign: "center" }}
          />
        </label>
        <label className="field">
          <span>Your name</span>
          <input placeholder="e.g. Bruno" value={nickname} maxLength={20}
            onChange={(e) => setNickname(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block">Enter game</button>
      </form>
    </main>
  );
}

export default function JoinPage() {
  return <Suspense><JoinInner /></Suspense>;
}
