"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

type KnockoutPromptState = {
  remaining: number;
  total: number;
};

export default function KnockoutStageToast() {
  const [prompt, setPrompt] = useState<KnockoutPromptState | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        if (!cancelled) setPrompt(null);
        return;
      }

      const profileRes = await supabase
        .from("profiles")
        .select("invite_code_used,is_admin")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profileRes.error || !profileRes.data || profileRes.data.is_admin || !profileRes.data.invite_code_used) {
        if (!cancelled) setPrompt(null);
        return;
      }

      const knockoutChapterRes = await supabase
        .from("chapters")
        .select("id,status")
        .eq("slug", "knockout-stage")
        .maybeSingle();

      if (knockoutChapterRes.error || !knockoutChapterRes.data || knockoutChapterRes.data.status !== "open") {
        if (!cancelled) setPrompt(null);
        return;
      }

      const [questionCountRes, pickCountRes] = await Promise.all([
        supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("chapter_id", knockoutChapterRes.data.id)
          .eq("is_active", true),
        supabase
          .from("picks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", session.user.id)
          .eq("chapter_id", knockoutChapterRes.data.id)
      ]);

      const total = questionCountRes.count ?? 0;
      const saved = pickCountRes.count ?? 0;

      if (
        questionCountRes.error ||
        pickCountRes.error ||
        total === 0 ||
        saved >= total
      ) {
        if (!cancelled) setPrompt(null);
        return;
      }

      if (!cancelled) {
        setPrompt({
          remaining: Math.max(total - saved, 0),
          total
        });
      }
    };

    void refresh();

    const interval = window.setInterval(() => {
      void refresh();
    }, 30000);

    const onFocus = () => {
      void refresh();
    };

    const onPicksUpdated = () => {
      void refresh();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("superleague:picks-updated", onPicksUpdated as EventListener);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("superleague:picks-updated", onPicksUpdated as EventListener);
    };
  }, []);

  if (!prompt) return null;

  const message =
    prompt.remaining === prompt.total
      ? "Knockout Stage is open. Make your picks before the deadline."
      : `Knockout Stage is open. You still need ${prompt.remaining} pick${prompt.remaining === 1 ? "" : "s"}.`;

  return (
    <div className="fixed top-5 left-1/2 z-50 w-[92%] max-w-xl -translate-x-1/2 rounded-xl border-2 border-red-400/80 bg-slate-950/95 p-3 text-sm text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        <button
          className="rounded-md border border-red-400/40 bg-red-400/10 px-2 py-1 text-xs uppercase tracking-[0.14em] text-red-100"
          onClick={() => router.push("/")}
          type="button"
        >
          Make Picks
        </button>
      </div>
    </div>
  );
}
