"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="article">
      <div className="grain" aria-hidden />
      <nav className="topbar">
        <a href="/">⟵ The Apocryphal Almanac</a>
      </nav>
      <div className="notice">
        <h1 className="notice-title">The ink ran dry</h1>
        <p className="notice-body">{error.message}</p>
        <button className="notice-action" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </main>
  );
}
