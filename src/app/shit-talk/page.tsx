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
  const [replies, setReplies] = useState<ShitTalkReply[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [hiddenReplies, setHiddenReplies] = useState<Record<string, boolean>>({});
  const [shitTalk, setShitTalk] = useState("");
  const [saving, setSaving] = useState(false);
  const [replyingKey, setReplyingKey] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);

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

    const repliesRes = await supabase
      .from("shit_talk_replies")
      .select("id,target_user_id,target_shit_talk_updated_at,user_id,message,created_at")
      .order("created_at", { ascending: true });

    const list = (updatesRes.data ?? []) as ShitTalkUpdate[];
    setUpdates(list);
    if (!repliesRes.error) {
      const rawReplies = (repliesRes.data ?? []) as ShitTalkReplyRow[];
      const replyUserIds = Array.from(new Set(rawReplies.map((reply) => reply.user_id)));
      const replyProfilesRes =
        replyUserIds.length > 0
          ? await supabase
              .from("profiles")
              .select("id,display_name,email,public_slug,avatar_url")
              .in("id", replyUserIds)
          : { data: [], error: null };

      const replyProfileMap = new Map(
        (replyProfilesRes.data ?? []).map((replyProfile) => [replyProfile.id, replyProfile])
      );
      const replyList = rawReplies.map((reply) => ({
        ...reply,
        profiles: replyProfileMap.get(reply.user_id) ?? null
      })) as ShitTalkReply[];
      setReplies(replyList);
    } else {
      setReplies([]);
    }
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
    if (!profile?.shit_talk || !profile?.shit_talk_updated_at) return { locked: false, remaining: "" };
    const last = new Date(profile.shit_talk_updated_at);
    const unlockAt = new Date(last.getTime() + 24 * 60 * 60 * 1000);
    if (now >= unlockAt) return { locked: false, remaining: "" };
    const diffMs = unlockAt.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return { locked: true, remaining: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` };
  }, [now, profile?.shit_talk, profile?.shit_talk_updated_at]);

  const remainingChars = useMemo(() => 200 - shitTalk.length, [shitTalk.length]);

  async function saveShitTalk() {
    if (!profile) return;
    if (cooldown.locked) {
      const {
        data: refreshedProfile
      } = await supabase
        .from("profiles")
        .select("shit_talk,shit_talk_updated_at")
        .eq("id", profile.id)
        .single();
      if (refreshedProfile?.shit_talk && refreshedProfile?.shit_talk_updated_at) {
        const unlockAt = new Date(refreshedProfile.shit_talk_updated_at).getTime() + 24 * 60 * 60 * 1000;
        if (Date.now() < unlockAt) {
          setNotice({ text: "Shit talk can only be changed once every 24 hours.", tone: "danger" });
          return;
        }
      }
    }

    setSaving(true);
    setNotice(null);

    const res = await supabase
      .from("profiles")
      .update({ shit_talk: shitTalk.trim() || null })
      .eq("id", profile.id);

    if (res.error) {
      setNotice({ text: res.error.message, tone: "danger" });
      setSaving(false);
      return;
    }

    setNotice({ text: "Shit Talk posted.", tone: "success" });
    await load();
    setSaving(false);
  }

  async function clearShitTalk(userId: string) {
    if (!isAdmin) return;
    setNotice(null);
    const res = await supabase.rpc("clear_shit_talk_by_admin", { target_user_id: userId });
    if (res.error) {
      setNotice({ text: res.error.message, tone: "danger" });
      return;
    }
    setNotice({ text: "Shit Talk removed.", tone: "success" });
    setUpdates((prev) => prev.filter((u) => u.id !== userId));
    await load();
  }

  async function clearReply(replyId: number) {
    if (!isAdmin) return;
    setNotice(null);
    const res = await supabase.rpc("delete_shit_talk_reply_by_admin", { target_reply_id: replyId });
    if (res.error) {
      setNotice({ text: res.error.message, tone: "danger" });
      return;
    }
    setNotice({ text: "Reply removed.", tone: "success" });
    setReplies((prev) => prev.filter((reply) => reply.id !== replyId));
  }

  function normalizedTimestamp(value: string | null) {
    if (!value) return "";
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? value : String(time);
  }

  function replyKeyFor(update: ShitTalkUpdate) {
    return `${update.id}:${normalizedTimestamp(update.shit_talk_updated_at)}`;
  }

  function repliesFor(update: ShitTalkUpdate) {
    return replies.filter(
      (reply) =>
        reply.target_user_id === update.id &&
        normalizedTimestamp(reply.target_shit_talk_updated_at) === normalizedTimestamp(update.shit_talk_updated_at)
    );
  }

  async function postReply(update: ShitTalkUpdate) {
    if (!user || !update.shit_talk_updated_at) return;
    const replyKey = replyKeyFor(update);
    const draft = (replyDrafts[replyKey] || "").trim();
    if (!draft) {
      setNotice({ text: "Reply cannot be empty.", tone: "danger" });
      return;
    }

    setReplyingKey(replyKey);
    setNotice(null);

    const res = await supabase.from("shit_talk_replies").insert({
      target_user_id: update.id,
      target_shit_talk_updated_at: update.shit_talk_updated_at,
      user_id: user.id,
      message: draft
    });

    if (res.error) {
      setNotice({ text: res.error.message, tone: "danger" });
      setReplyingKey(null);
      return;
    }

    setReplyDrafts((prev) => ({ ...prev, [replyKey]: "" }));
    setHiddenReplies((prev) => ({ ...prev, [replyKey]: false }));
    setNotice({ text: "Reply posted.", tone: "success" });
    await load();
    setReplyingKey(null);
  }

  if (loading) return <Loading label="Loading shit talk..." />;

  return (
    <>
      <AppHeader user={user} isAdmin={isAdmin} />
      {error ? <Notice text={error} tone="danger" /> : null}
      {notice ? <div className="mb-3"><Notice text={notice.text} tone={notice.tone} /></div> : null}

      <section className="glass rounded-2xl p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Shit Talk</h1>
          <span className="chip">All updates</span>
        </div>

        <div className="mb-5 rounded-xl border border-white/10 bg-slate-950/40 p-4">
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
            <span>You may only post once in a 24-hour period. Choose wisely!</span>
            <span>{remainingChars} characters remaining</span>
          </div>
          {cooldown.locked ? (
            <p className="mt-2 text-xs text-amber-200">
              Locked. You can shit talk again in {cooldown.remaining}. You can reply to posts in the meantime.
            </p>
          ) : null}
          <div className="mt-4">
            <button className="btn btn-primary" onClick={() => void saveShitTalk()} disabled={saving || cooldown.locked} type="button">
              {saving ? "Posting..." : "Post Shit Talk"}
            </button>
          </div>
        </div>

        {updates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-slate-950/35 p-5 text-sm text-slate-300">
            Be the first to talk that shit...
          </div>
        ) : null}

        <div className="space-y-3">
          {updates.map((u) => {
            const name = u.display_name || u.email || "Player";
            const when = u.shit_talk_updated_at ? new Date(u.shit_talk_updated_at).toLocaleString() : "";
            const replyKey = replyKeyFor(u);
            const threadReplies = repliesFor(u);
            const repliesHidden = hiddenReplies[replyKey] ?? false;
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
                <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Replies</p>
                    {threadReplies.length ? (
                      <button
                        className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-200 hover:bg-white/10"
                        onClick={() =>
                          setHiddenReplies((prev) => ({ ...prev, [replyKey]: !repliesHidden }))
                        }
                        type="button"
                      >
                        {repliesHidden ? "Unhide Replies" : "Hide Replies"}
                      </button>
                    ) : null}
                  </div>

                  {!repliesHidden ? (
                    <div className="space-y-2">
                      {threadReplies.map((reply) => {
                        const replyName = reply.profiles?.display_name || reply.profiles?.email || "Player";
                        return (
                          <div key={reply.id} className="ml-3 rounded-lg border border-white/10 bg-slate-950/50 p-3">
                            <div className="mb-1 flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {reply.profiles?.avatar_url ? (
                                  <Image
                                    alt="Reply avatar"
                                    className="h-7 w-7 rounded-full object-cover"
                                    src={reply.profiles.avatar_url}
                                    width={28}
                                    height={28}
                                  />
                                ) : (
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold">
                                    {replyName.slice(0, 1).toUpperCase()}
                                  </span>
                                )}
                                <div>
                                  <a
                                    className="text-xs font-semibold text-slate-100 underline decoration-white/20 hover:decoration-white"
                                    href={`/players/${reply.profiles?.public_slug || reply.user_id}`}
                                  >
                                    {replyName}
                                  </a>
                                  <p className="text-[11px] text-slate-400">{new Date(reply.created_at).toLocaleString()}</p>
                                </div>
                              </div>
                              {isAdmin ? (
                                <button
                                  className="rounded-md border border-red-400/40 bg-red-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-red-100"
                                  onClick={() => void clearReply(reply.id)}
                                  type="button"
                                >
                                  Remove
                                </button>
                              ) : null}
                            </div>
                            <p className="text-sm text-slate-200">{reply.message}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-col gap-2">
                    <textarea
                      className="min-h-20 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm"
                      maxLength={200}
                      value={replyDrafts[replyKey] || ""}
                      onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [replyKey]: e.target.value }))}
                      placeholder={`Reply to ${name}...`}
                      disabled={replyingKey === replyKey}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">
                        {(replyDrafts[replyKey] || "").length}/200
                      </span>
                      <button
                        className="btn btn-secondary"
                        onClick={() => void postReply(u)}
                        disabled={replyingKey === replyKey}
                        type="button"
                      >
                        {replyingKey === replyKey ? "Posting..." : "Post Reply"}
                      </button>
                    </div>
                  </div>
                </div>
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

type ShitTalkReplyRow = {
  id: number;
  target_user_id: string;
  target_shit_talk_updated_at: string;
  user_id: string;
  message: string;
  created_at: string;
};

type ShitTalkReply = {
  id: number;
  target_user_id: string;
  target_shit_talk_updated_at: string;
  user_id: string;
  message: string;
  created_at: string;
  profiles: {
    display_name: string | null;
    email: string;
    public_slug: string | null;
    avatar_url: string | null;
  } | null;
};
