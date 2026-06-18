export default function Loading() {
  return (
    <main className="article">
      <nav className="topbar">
        <span>Create-Wiki</span>
      </nav>
      <div className="loading">
        <p className="loading-text">Loading…</p>
        <div className="loading-bar" aria-hidden>
          <span />
        </div>
      </div>
    </main>
  );
}
