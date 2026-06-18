"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/slug";

export function SearchBox() {
  const [value, setValue] = useState("");
  const router = useRouter();

  function go(e: React.FormEvent) {
    e.preventDefault();
    const title = value.trim();
    if (!title) return;
    router.push(`/wiki/${slugify(title)}?t=${encodeURIComponent(title)}`);
  }

  return (
    <form onSubmit={go} className="searchbox">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Name any subject…"
        aria-label="Article title"
        autoFocus
      />
      <button type="submit">Conjure</button>
    </form>
  );
}
