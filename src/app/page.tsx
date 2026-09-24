import Link from "next/link";

export default function Home() {
  return (
    <main className="screen screen--narrow">
      <div className="stack">
        <div className="shapes" aria-hidden="true">
          <i className="s0">▲</i><i className="s1">◆</i><i className="s2">●</i><i className="s3">■</i>
        </div>
        <h1 className="wordmark">Live quizzes, played together.</h1>
        <p className="tagline">Host on the big screen. Everyone answers from their phone.</p>
      </div>

      <nav className="entries">
        <Link className="entry" href="/join">
          <span className="entry-shape tone-green" aria-hidden="true">▶</span>
          <span><b>Join a game</b><small>Enter the code from the host</small></span>
        </Link>
        <Link className="entry" href="/host">
          <span className="entry-shape tone-blue" aria-hidden="true">◆</span>
          <span><b>Host a game</b><small>Run a quiz on this screen</small></span>
        </Link>
        <Link className="entry" href="/admin">
          <span className="entry-shape tone-muted" aria-hidden="true">■</span>
          <span><b>Admin</b><small>Create and edit quizzes</small></span>
        </Link>
      </nav>
    </main>
  );
}
