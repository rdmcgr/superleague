"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

const SEEN_TAKEN_KEY_PREFIX = "side_bets_seen_taken_at:";
const SEEN_STATE_KEY_PREFIX = "side_bets_seen_state:";

type BetToastRow = {
  id: number;
  creator_id: string;
  taker_id: string | null;
  status: "open" | "taken" | "closed" | "cancelled";
  taken_at: string | null;
  creator_selected_winner_id: string | null;
  taker_selected_winner_id: string | null;
  winner_id: string | null;
  settled_at: string | null;
  creator: { display_name: string | null; email: string } | null;
  taker: { display_name: string | null; email: string } | null;
};

type SeenState = Record<
  string,
  {
    other_confirmed_winner_id: string | null;
    settled_at: string | null;
  }
>;

type ToastKind = "taken" | "confirmed" | "closed";

export default function SideBetToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [toastKind, setToastKind] = useState<ToastKind | null>(null);
  const [takenSeenKey, setTakenSeenKey] = useState<string | null>(null);
  const [stateSeenKey, setStateSeenKey] = useState<string | null>(null);
  const [latestSeenAt, setLatestSeenAt] = useState<number>(0);
  const [currentRows, setCurrentRows] = useState<BetToastRow[]>([]);
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session) return;

      const takenKey = `${SEEN_TAKEN_KEY_PREFIX}${session.user.id}`;
      const stateKey = `${SEEN_STATE_KEY_PREFIX}${session.user.id}`;
      setTakenSeenKey(takenKey);
      setStateSeenKey(stateKey);
      const seenAtRaw = localStorage.getItem(takenKey);
      const seenAt = seenAtRaw ? Number(seenAtRaw) : 0;
      setLatestSeenAt(seenAt);
      const seenStateRaw = localStorage.getItem(stateKey);
      const seenState = seenStateRaw ? (JSON.parse(seenStateRaw) as SeenState) : null;

      const { data, error } = await supabase
        .from("side_bets")
        .select(
          "id,creator_id,taker_id,status,taken_at,creator_selected_winner_id,taker_selected_winner_id,winner_id,settled_at,creator:creator_id(display_name,email),taker:taker_id(display_name,email)"
        )
        .not("taker_id", "is", null)
        .or(`creator_id.eq.${session.user.id},taker_id.eq.${session.user.id}`)
        .order("taken_at", { ascending: false })
        .limit(20);

      if (error || !data || data.length === 0) return;

      const rows = (data ?? []).map((row) => {
        const creatorValue = Array.isArray(row.creator) ? row.creator[0] : row.creator;
        const takerValue = Array.isArray(row.taker) ? row.taker[0] : row.taker;
        return { ...row, creator: creatorValue, taker: takerValue } as BetToastRow;
      });
      setCurrentRows(rows);

      const newlyClosed = rows.filter((row) => {
        if (!row.settled_at || !row.winner_id) return false;
        if (!seenState) return false;
        const previous = seenState[String(row.id)];
        return previous?.settled_at !== row.settled_at;
      });

      if (newlyClosed.length > 0) {
        if (newlyClosed.length === 1) {
          setMessage(`Your side bet with ${renderOtherUserName(newlyClosed[0], session.user.id)} is now closed.`);
        } else {
          setMessage(`${newlyClosed.length} of your side bets are now closed.`);
        }
        setToastKind("closed");
        setVisible(true);
        return;
      }

      const newlyConfirmed = rows.filter((row) => {
        const otherWinnerId = getOtherConfirmedWinnerId(row, session.user.id);
        if (!otherWinnerId || row.status === "closed") return false;
        if (!seenState) return false;
        const previous = seenState[String(row.id)];
        return previous?.other_confirmed_winner_id !== otherWinnerId;
      });

      if (newlyConfirmed.length > 0) {
        if (newlyConfirmed.length === 1) {
          setMessage(`${renderOtherUserName(newlyConfirmed[0], session.user.id)} confirmed the winner of your side bet.`);
        } else {
          setMessage(`${newlyConfirmed.length} of your side bets have new winner confirmations.`);
        }
        setToastKind("confirmed");
        setVisible(true);
        return;
      }

      const unseenTaken = rows.filter((row) => {
        if (row.creator_id !== session.user.id) return false;
        const takenAt = row.taken_at ? new Date(row.taken_at).getTime() : 0;
        return takenAt > seenAt;
      });

      if (unseenTaken.length === 0) {
        if (!seenState) {
          localStorage.setItem(stateKey, JSON.stringify(buildSeenState(rows, session.user.id)));
        }
        return;
      }

      if (unseenTaken.length === 1) {
        const name = unseenTaken[0].taker?.display_name || unseenTaken[0].taker?.email || "Someone";
        setMessage(`${name} took your side bet.`);
      } else {
        setMessage(`${unseenTaken.length} of your side bets were taken.`);
      }
      setToastKind("taken");
      setVisible(true);
    };

    void run();
  }, []);

  const markSeen = async () => {
    if (!takenSeenKey || !stateSeenKey) return;
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session) return;

    localStorage.setItem(stateSeenKey, JSON.stringify(buildSeenState(currentRows, session.user.id)));

    if (toastKind !== "taken") return;

    const latestTakenAt = currentRows
      .filter((row) => row.creator_id === session.user.id && row.taken_at)
      .map((row) => new Date(row.taken_at as string).getTime())
      .sort((a, b) => b - a)[0];

    const nextSeenAt = latestTakenAt ?? latestSeenAt;
    localStorage.setItem(takenSeenKey, String(nextSeenAt));
    setLatestSeenAt(nextSeenAt);
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

function renderOtherUserName(bet: BetToastRow, userId: string) {
  const otherUser = bet.creator_id === userId ? bet.taker : bet.creator;
  return otherUser?.display_name || otherUser?.email || "Someone";
}

function getOtherConfirmedWinnerId(bet: BetToastRow, userId: string) {
  if (bet.creator_id === userId) return bet.taker_selected_winner_id;
  if (bet.taker_id === userId) return bet.creator_selected_winner_id;
  return null;
}

function buildSeenState(rows: BetToastRow[], userId: string): SeenState {
  return rows.reduce<SeenState>((acc, row) => {
    acc[String(row.id)] = {
      other_confirmed_winner_id: getOtherConfirmedWinnerId(row, userId),
      settled_at: row.settled_at
    };
    return acc;
  }, {});
}
