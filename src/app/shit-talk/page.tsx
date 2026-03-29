"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import AppHeader from "@/components/AppHeader";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import { supabase } from "@/lib/supabase-browser";
import { useAuthResync } from "@/lib/useAuthResync";

export default function ShitTalkPage() {
  useAuthResync();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [updates, setUpdates] = useState<ShitTalkUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    setUser(session.user);

    const [profileRes, updatesRes] = await Promise.all([
      supabase.from("profiles").select("is_admin").eq("id", session.user.id).single(),
      supabase
        .from("profiles")
        .select("id,display_name,email,avatar_url,shit_talk,shit_talk_updated_at")
        .not("shit_talk", "is", null)
        .neq("shit_talk", "")
        .order("shit_talk_updated_at", { ascending: false })
    ]);

    if (profileRes.error || updatesRes.error) {
      setError("Could not load shit talk updates.");
      setLoading(false);
      return;
    }

    setIsAdmin(Boolean(profileRes.data?.is_admin));
    const list = (updatesRes.data ?? []) as ShitTalkUpdate[];
    setUpdates(list);
    if (list.length && list[0].shit_talk_updated_at) {
      localStorage.setItem("shit_talk_last_seen_page_at", String(new Date(list[0].shit_talk_updated_at).getTime()));
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function clearShitTalk(userId: string) {
    if (!isAdmin) return;
    setNotice(null);
    const res = await supabase.rpc("clear_shit_talk_by_admin", { target_user_id: userId });
    if (res.error) {
      setNotice(res.error.message);
      return;
    }
    setNotice("Shit Talk removed.");
    setUpdates((prev) => prev.filter((u) => u.id !== userId));
    await load();
  }

  if (loading) return <Loading label="Loading shit talk..." />;

  return (
    <>
      <AppHeader user={user} isAdmin={isAdmin} />
      {error ? <Notice text={error} tone="danger" /> : null}
      {notice ? <div className="mb-3"><Notice text={notice} tone="success" /></div> : null}

      <section className="glass rounded-2xl p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Shit Talk</h1>
          <span className="chip">All updates</span>
        </div>

        <div className="space-y-3">
          {updates.map((u) => {
            const name = u.display_name || u.email || "Player";
            const when = u.shit_talk_updated_at ? new Date(u.shit_talk_updated_at).toLocaleString() : "";
            return (
              <article key={u.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {u.avatar_url ? (
                      <Image
                        alt="Player avatar"
                        className="h-10 w-10 rounded-full object-cover"
                        src={u.avatar_url}
                        width={40}
                        height={40}
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                        {name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <p className="font-semibold text-slate-100">{name}</p>
                      <p className="text-xs text-slate-400">{when}</p>
                    </div>
                  </div>
                  {isAdmin ? (
                    <button
                      className="rounded-md border border-red-400/40 bg-red-400/10 px-2 py-1 text-xs uppercase tracking-[0.14em] text-red-100"
                      onClick={() => void clearShitTalk(u.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="text-sm text-slate-200">{u.shit_talk}</p>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

type ShitTalkUpdate = {
  id: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  shit_talk: string | null;
  shit_talk_updated_at: string | null;
};
