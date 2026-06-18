export default function Loading() {
  return (
    <main className="article">
      <div className="grain" aria-hidden />
      <nav className="topbar">
        <span>⟵ The Apocryphal Almanac</span>
      </nav>
      <div className="conjuring">
        <div className="conjuring-mark" aria-hidden>
          ❦
        </div>
        <p className="conjuring-text">Consulting the archives…</p>
        <p className="conjuring-sub">
          An entry is being written and illustrated. This can take a little while.
        </p>
      </div>
    </main>
  );
}
