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
      <nav className="topbar">
        <a href="/">Create-Wiki</a>
      </nav>
      <div className="notice">
        <h1 className="notice-title">Couldn’t generate this article</h1>
        <p className="notice-body">{error.message}</p>
        <button className="notice-action" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </main>
  );
}
