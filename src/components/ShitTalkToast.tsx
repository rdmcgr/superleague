"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

const STORAGE_KEY = "shit_talk_toast_seen_at";

export default function ShitTalkToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const queueRef = useRef<{ label: string; ts: number }[]>([]);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const run = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session) return;

      const seenAtRaw = localStorage.getItem(STORAGE_KEY);
      const seenAt = seenAtRaw ? Number(seenAtRaw) : 0;

      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,email,shit_talk_updated_at")
        .not("shit_talk_updated_at", "is", null)
        .neq("id", session.user.id)
        .gt("shit_talk_updated_at", new Date(seenAt).toISOString())
        .order("shit_talk_updated_at", { ascending: true });

      if (error || !data || data.length === 0) return;

      queueRef.current = data.map((row) => {
        const name = row.display_name || row.email || "Someone";
        const ts = new Date(row.shit_talk_updated_at as string).getTime();
        return { label: `New Shit Talk from ${name}.`, ts };
      });

      const showNext = () => {
        const next = queueRef.current.shift();
        if (!next) return;
        setMessage(next.label);
        setVisible(true);
        localStorage.setItem(STORAGE_KEY, String(next.ts));
        timeoutRef.current = window.setTimeout(() => {
          setVisible(false);
          timeoutRef.current = window.setTimeout(showNext, 500);
        }, 4500);
      };

      showNext();
    };

    void run();

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!message || !visible) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-white/15 bg-slate-950/90 p-3 text-sm text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        <button
          className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs uppercase tracking-[0.14em] text-slate-200"
          onClick={() => {
            setVisible(false);
          }}
          type="button"
        >
          Close
        </button>
      </div>
    </div>
  );
}
