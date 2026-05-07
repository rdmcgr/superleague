"use client";

import { useEffect, useMemo, useState } from "react";

export default function StoryCardPreviewPage() {
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setStorageKey(params.get("key"));
  }, []);

  const pollKey = useMemo(() => (storageKey ? `story-card-preview:${storageKey}` : null), [storageKey]);

  useEffect(() => {
    if (!pollKey) return;

    let cancelled = false;
    const startedAt = Date.now();

    const tryLoad = () => {
      if (cancelled) return;
      const stored = window.localStorage.getItem(pollKey);
      if (stored) {
        setDataUrl(stored);
        window.localStorage.removeItem(pollKey);
        return;
      }
      if (Date.now() - startedAt > 20000) {
        setTimedOut(true);
        return;
      }
      window.setTimeout(tryLoad, 250);
    };

    tryLoad();

    return () => {
      cancelled = true;
    };
  }, [pollKey]);

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-6 text-slate-50"
      style={{
        background:
          "radial-gradient(circle at 20% 0%, rgba(32, 232, 160, 0.16), transparent 28%), linear-gradient(180deg, #07111d 0%, #0b1730 55%, #0a1220 100%)"
      }}
    >
      {dataUrl ? (
        <img alt="Story card preview" className="block h-auto max-w-full rounded-xl shadow-[0_24px_80px_rgba(0,0,0,0.45)]" src={dataUrl} />
      ) : (
        <div className="max-w-sm rounded-2xl border border-white/10 bg-white/6 px-6 py-5 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <p className="text-base font-semibold">{timedOut ? "Could not load story card." : "Preparing your story card..."}</p>
          <p className="mt-2 text-sm text-slate-300/80">
            {timedOut ? "Go back and try again." : "This should only take a moment."}
          </p>
        </div>
      )}
    </main>
  );
}
