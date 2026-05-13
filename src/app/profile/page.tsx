"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import { toPng } from "html-to-image";
import AppHeader from "@/components/AppHeader";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import ShareProfileStoryCard from "@/components/ShareProfileStoryCard";
import { flagForCode } from "@/lib/flags";
import { supabase } from "@/lib/supabase-browser";
import { buildGroupStageStoryCardSections, buildKnockoutStageStoryCardSections } from "@/lib/story-card";
import { useAuthResync } from "@/lib/useAuthResync";
import type { Chapter, Profile, Question, Team } from "@/lib/types";

export default function ProfilePage() {
  useAuthResync();
  const router = useRouter();
  const storyCardRef = useRef<HTMLDivElement | null>(null);
  const knockoutStoryCardRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAllegiance, setSavingAllegiance] = useState(false);
  const [savingStoryCard, setSavingStoryCard] = useState(false);
  const [savingKnockoutStoryCard, setSavingKnockoutStoryCard] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [allegianceTeamId, setAllegianceTeamId] = useState("");
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
        .select("id,email,display_name,public_slug,avatar_url,allegiance_team_id,shit_talk,shit_talk_updated_at,invite_code_used,invite_approved_at,is_admin")
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
    setAllegianceTeamId(profileRes.data.allegiance_team_id ? String(profileRes.data.allegiance_team_id) : "");
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
  const groupStageShareSections = useMemo(
    () => buildGroupStageStoryCardSections(chapters, questions, picks, teams),
    [chapters, picks, questions, teams]
  );
  const knockoutStageShareSections = useMemo(
    () => buildKnockoutStageStoryCardSections(chapters, questions, picks, teams),
    [chapters, picks, questions, teams]
  );
  const activeTeams = useMemo(() => teams.filter((team) => team.is_active), [teams]);
  const allegianceTeam = useMemo(
    () => teams.find((team) => team.id === Number(allegianceTeamId)) ?? null,
    [allegianceTeamId, teams]
  );
  const normalizedShitTalk = shitTalk.trim() || null;
  const normalizedSavedShitTalk = profile?.shit_talk ?? null;
  const savedAllegianceTeamId = profile?.allegiance_team_id ?? null;
  const shitTalkChanged = normalizedShitTalk !== normalizedSavedShitTalk;

  const canShareGroupStageStoryCard = Boolean(profile?.public_slug) && groupStageShareSections.length > 0;
  const canShareKnockoutStoryCard = Boolean(profile?.public_slug) && knockoutStageShareSections.length > 0;
  const canShareAnything = canShareGroupStageStoryCard || canShareKnockoutStoryCard;

  async function save() {
    if (!profile) return;
    if (!shitTalkChanged) {
      setNotice({ text: "Nothing changed.", tone: "neutral" });
      return;
    }

    if (shitTalkChanged && cooldown.locked) {
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
      .update({
        shit_talk: normalizedShitTalk
      })
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

  async function saveAllegiance(nextValue: string) {
    if (!profile) return;
    const nextTeamId = nextValue ? Number(nextValue) : null;
    if (nextTeamId === savedAllegianceTeamId) return;

    setAllegianceTeamId(nextValue);
    setSavingAllegiance(true);
    setNotice(null);

    const res = await supabase
      .from("profiles")
      .update({ allegiance_team_id: nextTeamId })
      .eq("id", profile.id);

    if (res.error) {
      setNotice({ text: res.error.message, tone: "danger" });
      setAllegianceTeamId(savedAllegianceTeamId ? String(savedAllegianceTeamId) : "");
      setSavingAllegiance(false);
      return;
    }

    setProfile((current) => (current ? { ...current, allegiance_team_id: nextTeamId } : current));
    setNotice({ text: "Allegiance saved.", tone: "success" });
    setSavingAllegiance(false);
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

  async function saveStoryCard(stage: "group" | "knockout") {
    const targetRef = stage === "knockout" ? knockoutStoryCardRef : storyCardRef;
    if (!targetRef.current || !profile) return;
    if (stage === "knockout") {
      setSavingKnockoutStoryCard(true);
    } else {
      setSavingStoryCard(true);
    }
    setNotice(null);

    const userAgent = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(userAgent);
    const shouldOpenPreviewTab = isIOS || isAndroid;
    const stageLabel = stage === "knockout" ? "Knockout Stage story card" : "Group Stage story card";
    const fileSlug = stage === "knockout" ? "knockout-stage-story" : "group-stage-story";
    const previewTab = shouldOpenPreviewTab ? window.open(`/story-card-preview?stage=${stage}`, "_blank") : null;

    try {
      if (previewTab) {
        setNotice({ text: `${stageLabel} preview opened in a new tab.`, tone: "success" });
        return;
      }

      const dataUrl = await toPng(targetRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        canvasWidth: 1080,
        canvasHeight: 1920
      });

      const blob = await (await fetch(dataUrl)).blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `superleague-${profile.public_slug ?? profile.id}-${fileSlug}.png`;
      link.href = objectUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      setNotice({ text: `${stageLabel} saved.`, tone: "success" });
    } catch {
      setNotice({ text: `Could not create ${stageLabel.toLowerCase()}.`, tone: "danger" });
    } finally {
      if (stage === "knockout") {
        setSavingKnockoutStoryCard(false);
      } else {
        setSavingStoryCard(false);
      }
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

        {canShareAnything ? (
          <div className="mb-6 flex flex-wrap gap-3">
            <button
              className="rounded-lg bg-white/12 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/16"
              onClick={() => void copyProfileLink()}
              type="button"
            >
              Copy Profile Link
            </button>
            {canShareGroupStageStoryCard ? (
              <button
                className="rounded-lg bg-[linear-gradient(135deg,var(--accent),#2ae6ff)] px-3 py-2 text-xs font-semibold text-[#0e1b2b] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-55"
                onClick={() => void saveStoryCard("group")}
                disabled={savingStoryCard}
                type="button"
              >
                <StoryCardButtonLabel
                  text={savingStoryCard ? "Downloading Group Stage Story Card..." : "Download Group Stage Story Card"}
                />
              </button>
            ) : null}
            {canShareKnockoutStoryCard ? (
              <button
                className="rounded-lg bg-[linear-gradient(135deg,var(--accent),#2ae6ff)] px-3 py-2 text-xs font-semibold text-[#0e1b2b] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-55"
                onClick={() => void saveStoryCard("knockout")}
                disabled={savingKnockoutStoryCard}
                type="button"
              >
                <StoryCardButtonLabel
                  text={
                    savingKnockoutStoryCard
                      ? "Downloading Knockout Stage Story Card..."
                      : "Download Knockout Stage Story Card"
                  }
                />
              </button>
            ) : null}
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

          <label className="text-sm text-slate-300">
            My Allegiance
            <select
              className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm"
              value={allegianceTeamId}
              onChange={(e) => void saveAllegiance(e.target.value)}
              disabled={savingAllegiance}
            >
              <option value="">Select team</option>
              {activeTeams.map((team) => {
                const flag = flagForCode(team.code);
                return (
                  <option key={team.id} value={team.id}>
                    {flag ? `${flag} ${team.name}` : team.name}
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        {allegianceTeam ? (
          <p className="mt-3 text-sm text-slate-300">
            Current allegiance: {flagForCode(allegianceTeam.code)} {allegianceTeam.name}
          </p>
        ) : null}
        {savingAllegiance ? <p className="mt-1 text-xs text-slate-400">Saving allegiance...</p> : null}

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
          <button className="btn btn-primary" onClick={() => void save()} disabled={saving || !shitTalkChanged} type="button">
            {saving ? "Saving..." : "Save Shit Talk"}
          </button>
        </div>
      </section>

      {profile ? (
        <div aria-hidden="true" className="pointer-events-none fixed left-[-99999px] top-0 opacity-0">
          {canShareGroupStageStoryCard ? (
            <div ref={storyCardRef}>
              <ShareProfileStoryCard
                avatarUrl={profile.avatar_url}
                displayName={profile.display_name || profile.email}
                allegiance={allegianceTeam ? `${flagForCode(allegianceTeam.code)} ${allegianceTeam.name}` : null}
                introLine="Check out my picks for the tourney:"
                sections={groupStageShareSections}
              />
            </div>
          ) : null}
          {canShareKnockoutStoryCard ? (
            <div ref={knockoutStoryCardRef}>
              <ShareProfileStoryCard
                avatarUrl={profile.avatar_url}
                displayName={profile.display_name || profile.email}
                allegiance={allegianceTeam ? `${flagForCode(allegianceTeam.code)} ${allegianceTeam.name}` : null}
                introLine="Check out my picks for the knockout stage:"
                sections={knockoutStageShareSections}
              />
            </div>
          ) : null}
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

function StoryCardButtonLabel({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="inline-flex h-4 w-4 items-center justify-center rounded-[5px] bg-[linear-gradient(135deg,#feda75_0%,#fa7e1e_28%,#d62976_58%,#962fbf_80%,#4f5bd5_100%)]"
      >
        <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span>{text}</span>
    </span>
  );
}
