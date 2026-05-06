"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import { toPng } from "html-to-image";
import AppHeader from "@/components/AppHeader";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import ShareProfileStoryCard, { type ShareSection } from "@/components/ShareProfileStoryCard";
import { flagForCode } from "@/lib/flags";
import { supabase } from "@/lib/supabase-browser";
import { useAuthResync } from "@/lib/useAuthResync";
import type { Chapter, Profile, Question, Team } from "@/lib/types";

export default function ProfilePage() {
  useAuthResync();
  const router = useRouter();
  const storyCardRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStoryCard, setSavingStoryCard] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [shitTalk, setShitTalk] = useState("");
  const [now, setNow] = useState<Date>(new Date());
  const [notice, setNotice] = useState<{ text: string; tone: "neutral" | "success" | "danger" } | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    setUser(session.user);

    const [profileRes, chaptersRes, questionsRes, teamsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,email,display_name,public_slug,avatar_url,shit_talk,shit_talk_updated_at,invite_code_used,invite_approved_at,is_admin")
        .eq("id", session.user.id)
        .single(),
      supabase.from("chapters").select("id,slug,name,status,opens_at,locks_at").order("id"),
      supabase.from("questions").select("id,chapter_id,prompt,order_index,points,short_label,is_active").order("chapter_id").order("order_index"),
      supabase.from("teams").select("id,name,code,is_active").order("name")
    ]);

    if (profileRes.error || chaptersRes.error || questionsRes.error || teamsRes.error) {
      setNotice({ text: "Could not load profile.", tone: "danger" });
      setLoading(false);
      return;
    }

    setProfile(profileRes.data);
    if (!profileRes.data.invite_code_used && !profileRes.data.is_admin) {
      router.replace("/invite");
      return;
    }
    setChapters(chaptersRes.data ?? []);
    setQuestions(questionsRes.data ?? []);
    setTeams(teamsRes.data ?? []);

    const lockedIds = (chaptersRes.data ?? [])
      .filter((chapter) => chapter.status === "locked" || chapter.status === "graded")
      .map((chapter) => chapter.id);

    if (lockedIds.length) {
      const picksRes = await supabase
        .from("picks")
        .select("id,question_id,chapter_id,team_id")
        .eq("user_id", session.user.id)
        .in("chapter_id", lockedIds);
      if (!picksRes.error) {
        setPicks((picksRes.data ?? []) as PickRow[]);
      } else {
        setPicks([]);
      }
    } else {
      setPicks([]);
    }

    setShitTalk(profileRes.data.shit_talk ?? "");
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadProfile();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadProfile]);

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
  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  const shareSections = useMemo(() => {
    const groupStage = chapters.find((chapter) => chapter.slug === "group-stage");
    if (!groupStage || (groupStage.status !== "locked" && groupStage.status !== "graded")) return [] as ShareSection[];

    const questionByOrder = (orderIndex: number) =>
      questions.find((question) => question.chapter_id === groupStage.id && question.order_index === orderIndex);
    const teamLabelForQuestion = (questionId: number | undefined) => {
      if (!questionId) return null;
      const pick = picks.find((entry) => entry.question_id === questionId);
      if (!pick) return null;
      const team = teamMap.get(pick.team_id);
      if (!team) return null;
      const flag = flagForCode(team.code);
      return `${flag ? `${flag} ` : ""}${team.name}`;
    };

    const sections: ShareSection[] = [];
    const tourneyWinner = teamLabelForQuestion(questionByOrder(1)?.id);
    if (tourneyWinner) {
      sections.push({
        title: "Champion",
        items: [tourneyWinner]
      });
    }

    const groupWinners = [teamLabelForQuestion(questionByOrder(2)?.id), teamLabelForQuestion(questionByOrder(3)?.id)].filter(
      (value): value is string => Boolean(value)
    );
    if (groupWinners.length) {
      sections.push({
        title: "Group Winners",
        items: groupWinners
      });
    }

    const qualifiers = [teamLabelForQuestion(questionByOrder(4)?.id), teamLabelForQuestion(questionByOrder(5)?.id)].filter(
      (value): value is string => Boolean(value)
    );
    if (qualifiers.length) {
      sections.push({
        title: "Additional Knockout Stage Qualifiers",
        items: qualifiers
      });
    }

    return sections;
  }, [chapters, picks, questions, teamMap]);

  const canShareProfile = Boolean(profile?.public_slug) && shareSections.length > 0;

  async function save() {
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

    setNotice({ text: "Shit talk saved.", tone: "success" });
    await loadProfile();
    setSaving(false);
  }

  async function copyProfileLink() {
    if (!profile?.public_slug) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/players/${profile.public_slug}`);
      setNotice({ text: "Profile link copied.", tone: "success" });
    } catch {
      setNotice({ text: "Could not copy profile link.", tone: "danger" });
    }
  }

  async function saveStoryCard() {
    if (!storyCardRef.current || !profile) return;
    setSavingStoryCard(true);
    setNotice(null);
    try {
      const dataUrl = await toPng(storyCardRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        canvasWidth: 1080,
        canvasHeight: 1920
      });
      const link = document.createElement("a");
      link.download = `superleague-${profile.public_slug ?? profile.id}-story.png`;
      link.href = dataUrl;
      link.click();
      setNotice({ text: "Story card saved.", tone: "success" });
    } catch {
      setNotice({ text: "Could not create story card.", tone: "danger" });
    } finally {
      setSavingStoryCard(false);
    }
  }

  if (loading) return <Loading label="Loading profile..." />;

  return (
    <>
      <AppHeader user={user} isAdmin={Boolean(profile?.is_admin)} />
      {notice ? <div className="mb-4"><Notice text={notice.text} tone={notice.tone} /></div> : null}

      <section className="glass rounded-2xl p-6">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          {profile?.avatar_url ? (
            <Image
              alt="Profile avatar"
              className="h-20 w-20 rounded-full object-cover"
              src={profile.avatar_url}
              width={80}
              height={80}
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">
              {(profile?.display_name || profile?.email || "U").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">Your Profile</h1>
          </div>
        </div>

        {canShareProfile ? (
          <div className="mb-6 flex flex-wrap gap-3">
            <button className="btn btn-secondary" onClick={() => void copyProfileLink()} type="button">
              Copy Profile Link
            </button>
            <button className="btn btn-primary" onClick={() => void saveStoryCard()} disabled={savingStoryCard} type="button">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-[6px] bg-[linear-gradient(135deg,#feda75_0%,#fa7e1e_28%,#d62976_58%,#962fbf_80%,#4f5bd5_100%)]"
                >
                  <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="4" width="16" height="16" rx="4" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <span>{savingStoryCard ? "Downloading Story Card..." : "Download Story Card"}</span>
              </span>
            </button>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-300">
            Email
            <input
              className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-400"
              value={profile?.email || ""}
              disabled
            />
          </label>

          <label className="text-sm text-slate-300">
            Display name
            <input
              className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-400"
              value={profile?.display_name || ""}
              disabled
            />
          </label>
        </div>

        <div className="mt-4">
          <label className="text-sm text-slate-300">
            Shit Talk
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm"
              maxLength={200}
              value={shitTalk}
              onChange={(e) => setShitTalk(e.target.value)}
              placeholder="Say something memorable. Keep it fun."
              disabled={cooldown.locked}
            />
          </label>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>Visible to other players. 200 character max.</span>
            <span>{remainingChars} characters remaining</span>
          </div>
          {cooldown.locked ? (
            <p className="mt-1 text-xs text-amber-200">
              Shit talk locked. You can edit again in {cooldown.remaining}.
            </p>
          ) : null}
        </div>

        <div className="mt-6">
          <button className="btn btn-primary" onClick={() => void save()} disabled={saving || cooldown.locked} type="button">
            {saving ? "Saving..." : "Save Shit Talk"}
          </button>
        </div>
      </section>

      {canShareProfile && profile ? (
        <div aria-hidden="true" className="pointer-events-none fixed left-[-99999px] top-0 opacity-0">
          <div ref={storyCardRef}>
            <ShareProfileStoryCard
              avatarUrl={profile.avatar_url}
              displayName={profile.display_name || profile.email}
              shitTalk={profile.shit_talk}
              sections={shareSections}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

type PickRow = {
  id: number;
  question_id: number;
  chapter_id: number;
  team_id: number;
};
