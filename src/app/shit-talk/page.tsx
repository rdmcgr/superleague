"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import AppHeader from "@/components/AppHeader";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import { supabase } from "@/lib/supabase-browser";
import { useAuthResync } from "@/lib/useAuthResync";
import type { Profile } from "@/lib/types";

export default function ShitTalkPage() {
  useAuthResync();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [updates, setUpdates] = useState<ShitTalkUpdate[]>([]);
  const [shitTalk, setShitTalk] = useState("");
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
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

    const profileRes = await supabase
      .from("profiles")
      .select("id,email,display_name,public_slug,avatar_url,shit_talk,shit_talk_updated_at,invite_code_used,invite_approved_at,is_admin")
      .eq("id", session.user.id)
      .single();

    if (profileRes.error) {
      setError("Could not load shit talk updates.");
      setLoading(false);
      return;
    }

    setProfile(profileRes.data as Profile);
    setIsAdmin(Boolean(profileRes.data?.is_admin));
    if (!profileRes.data?.invite_code_used && !profileRes.data?.is_admin) {
      router.replace("/invite");
      return;
    }
    setShitTalk(profileRes.data?.shit_talk ?? "");

    const updatesRes = await supabase
      .from("profiles")
      .select("id,public_slug,display_name,email,avatar_url,shit_talk,shit_talk_updated_at")
      .not("shit_talk", "is", null)
      .neq("shit_talk", "")
      .order("shit_talk_updated_at", { ascending: false });

    if (updatesRes.error) {
      setError("Could not load shit talk updates.");
      setLoading(false);
      return;
    }
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

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const cooldown = useMemo(() => {
    if (!profile?.shit_talk_updated_at) return { locked: false, remaining: "" };
    const last = new Date(profile.shit_talk_updated_at);
    const unlockAt = new Date(last.getTime() + 24 * 60 * 60 * 1000);
    if (now >= unlockAt) return { locked: false, remaining: "" };
    const diffMs = unlockAt.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return { locked: true, remaining: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` };
  }, [now, profile?.shit_talk_updated_at]);

  const remainingChars = useMemo(() => 200 - shitTalk.length, [shitTalk.length]);

  async function saveShitTalk() {
    if (!profile) return;
    if (cooldown.locked) {
      await load();
      if (cooldown.locked) {
        setNotice("Shit talk can only be changed once every 24 hours.");
        return;
      }
    }

    setSaving(true);
    setNotice(null);

    const res = await supabase
      .from("profiles")
      .update({ shit_talk: shitTalk.trim() || null })
      .eq("id", profile.id);

    if (res.error) {
      setNotice(res.error.message);
      setSaving(false);
      return;
    }

    setNotice("Shit Talk saved.");
    await load();
    setSaving(false);
  }

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

        <div className="mb-5 rounded-xl border border-white/10 bg-slate-950/40 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">Post Shit Talk</h2>
          <label className="text-sm text-slate-300">
            Your Message
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm"
              maxLength={200}
              value={shitTalk}
              onChange={(e) => setShitTalk(e.target.value)}
              placeholder="Say something memorable. Keep it fun."
              disabled={cooldown.locked || saving}
            />
          </label>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>Visible to other players. 200 character max.</span>
            <span>{remainingChars} characters remaining</span>
          </div>
          {cooldown.locked ? (
            <p className="mt-2 text-xs text-amber-200">
              Shit Talk locked. You can edit again in {cooldown.remaining}.
            </p>
          ) : null}
          <div className="mt-4">
            <button className="btn btn-primary" onClick={() => void saveShitTalk()} disabled={saving || cooldown.locked} type="button">
              {saving ? "Saving..." : "Save Shit Talk"}
            </button>
          </div>
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
                      <a className="font-semibold text-slate-100 underline decoration-white/20 hover:decoration-white" href={`/players/${u.public_slug || u.id}`}>
                        {name}
                      </a>
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
  public_slug: string | null;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  shit_talk: string | null;
  shit_talk_updated_at: string | null;
};
