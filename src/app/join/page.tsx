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
    <main className="container">
      <h1>Join the game</h1>
      <form onSubmit={join} className="card">
        <input placeholder="Game code" value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} />
        <input placeholder="Your name" value={nickname}
          onChange={(e) => setNickname(e.target.value)} style={{ marginTop: 8 }} />
        {error && <p style={{ color: "var(--red)" }}>{error}</p>}
        <button type="submit" style={{ marginTop: 12 }}>Enter</button>
      </form>
    </main>
  );
}

export default function JoinPage() {
  return <Suspense><JoinInner /></Suspense>;
}
