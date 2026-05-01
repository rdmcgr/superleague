"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

const SEEN_TAKEN_KEY_PREFIX = "side_bets_seen_taken_at:";

type BetToastRow = {
  id: number;
  creator_id: string;
  taker_id: string | null;
  team_a_id: number;
  team_b_id: number;
  taken_at: string | null;
  taker: { display_name: string | null; email: string } | null;
};

export default function SideBetToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [seenKey, setSeenKey] = useState<string | null>(null);
  const [latestSeenAt, setLatestSeenAt] = useState<number>(0);
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session) return;

      const key = `${SEEN_TAKEN_KEY_PREFIX}${session.user.id}`;
      setSeenKey(key);
      const seenAtRaw = localStorage.getItem(key);
      const seenAt = seenAtRaw ? Number(seenAtRaw) : 0;
      setLatestSeenAt(seenAt);

      const { data, error } = await supabase
        .from("side_bets")
        .select("id,creator_id,taker_id,team_a_id,team_b_id,taken_at,taker:taker_id(display_name,email)")
        .eq("creator_id", session.user.id)
        .not("taker_id", "is", null)
        .not("taken_at", "is", null)
        .order("taken_at", { ascending: false })
        .limit(5);

      if (error || !data || data.length === 0) return;

      const rows = (data ?? []).map((row) => {
        const takerValue = Array.isArray(row.taker) ? row.taker[0] : row.taker;
        return { ...row, taker: takerValue } as BetToastRow;
      });

      const unseen = rows.filter((row) => {
        const takenAt = row.taken_at ? new Date(row.taken_at).getTime() : 0;
        return takenAt > seenAt;
      });

      if (unseen.length === 0) return;

      if (unseen.length === 1) {
        const name = unseen[0].taker?.display_name || unseen[0].taker?.email || "Someone";
        setMessage(`${name} took your side bet.`);
      } else {
        setMessage(`${unseen.length} of your side bets were taken.`);
      }
      setVisible(true);
    };

    void run();
  }, []);

  const markSeen = async () => {
    if (!seenKey) return;
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("side_bets")
      .select("taken_at")
      .eq("creator_id", session.user.id)
      .not("taker_id", "is", null)
      .not("taken_at", "is", null)
      .order("taken_at", { ascending: false })
      .limit(1);

    const latestTakenAt = data?.[0]?.taken_at ? new Date(data[0].taken_at).getTime() : latestSeenAt;
    localStorage.setItem(seenKey, String(latestTakenAt));
    setLatestSeenAt(latestTakenAt);
  };

  if (!message || !visible) return null;

  return (
    <div
      className="fixed top-5 left-1/2 z-50 w-[92%] max-w-xl -translate-x-1/2 rounded-xl border-2 border-red-400/80 bg-slate-950/95 p-3 text-sm text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      role="button"
      tabIndex={0}
      onClick={async () => {
        await markSeen();
        router.push("/side-bets");
        setVisible(false);
      }}
      onKeyDown={async (e) => {
        if (e.key === "Enter" || e.key === " ") {
          await markSeen();
          router.push("/side-bets");
          setVisible(false);
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        <button
          className="rounded-md border border-red-400/40 bg-red-400/10 px-2 py-1 text-xs uppercase tracking-[0.14em] text-red-100"
          onClick={async (e) => {
            e.stopPropagation();
            await markSeen();
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
