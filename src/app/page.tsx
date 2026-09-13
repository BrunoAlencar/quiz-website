import Link from "next/link";

export default function Home() {
  return (
    <main className="container">
      <h1>Quiz</h1>
      <p><Link href="/join">Join a game</Link></p>
      <p><Link href="/host">Host a game</Link></p>
      <p><Link href="/admin">Admin</Link></p>
    </main>
  );
}
