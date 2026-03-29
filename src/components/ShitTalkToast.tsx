"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

const SEEN_PAGE_KEY = "shit_talk_last_seen_page_at";

export default function ShitTalkToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [linkable, setLinkable] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session) return;

      const seenAtRaw = localStorage.getItem(SEEN_PAGE_KEY);
      const seenAt = seenAtRaw ? Number(seenAtRaw) : 0;

      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,email,shit_talk_updated_at")
        .not("shit_talk_updated_at", "is", null)
        .neq("id", session.user.id)
        .order("shit_talk_updated_at", { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) return;

      const latest = data[0];
      const latestAt = new Date(latest.shit_talk_updated_at as string).getTime();
      if (latestAt <= seenAt) return;

      const name = latest.display_name || latest.email || "Someone";
      setMessage(`New Shit Talk from ${name}.`);
      setLinkable(true);
      setVisible(true);
    };

    void run();

  }, []);

  if (!message || !visible) return null;

  return (
    <div
      className="fixed top-5 left-1/2 z-50 w-[92%] max-w-xl -translate-x-1/2 rounded-xl border-2 border-red-400/80 bg-slate-950/95 p-3 text-sm text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!linkable) return;
        router.push("/shit-talk");
        setVisible(false);
      }}
      onKeyDown={(e) => {
        if (!linkable) return;
        if (e.key === "Enter" || e.key === " ") {
          router.push("/shit-talk");
          setVisible(false);
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        <button
          className="rounded-md border border-red-400/40 bg-red-400/10 px-2 py-1 text-xs uppercase tracking-[0.14em] text-red-100"
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
