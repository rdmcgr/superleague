"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import ShareProfileStoryCard from "@/components/ShareProfileStoryCard";
import { supabase } from "@/lib/supabase-browser";
import { buildStoryCardSections } from "@/lib/story-card";
import { useAuthResync } from "@/lib/useAuthResync";
import type { Chapter, Profile, Question, Team } from "@/lib/types";

export default function StoryCardPreviewPage() {
  useAuthResync();
  const storyCardRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "neutral" | "success" | "danger" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      setNotice({ text: "Please sign in again to generate your story card.", tone: "danger" });
      setLoading(false);
      return;
    }

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
      setNotice({ text: "Could not load your story card.", tone: "danger" });
      setLoading(false);
      return;
    }

    setProfile(profileRes.data);
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

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shareSections = useMemo(() => buildStoryCardSections(chapters, questions, picks, teams), [chapters, picks, questions, teams]);

  useEffect(() => {
    async function generate() {
      if (loading || !profile || !storyCardRef.current) return;
      if (shareSections.length === 0) {
        setNotice({ text: "No public picks are available to share yet.", tone: "danger" });
        setRendering(false);
        return;
      }

      setRendering(true);
      setNotice(null);

      try {
        const dataUrl = await toPng(storyCardRef.current, {
          cacheBust: true,
          pixelRatio: 1,
          canvasWidth: 1080,
          canvasHeight: 1920
        });
        setImageUrl(dataUrl);
      } catch {
        setNotice({ text: "Could not generate your story card.", tone: "danger" });
      } finally {
        setRendering(false);
      }
    }

    void generate();
  }, [loading, profile, shareSections]);

  if (loading) {
    return <Loading label="Preparing your story card..." />;
  }

  return (
    <>
      {notice ? <div className="mx-auto mt-4 max-w-2xl px-4"><Notice text={notice.text} tone={notice.tone} /></div> : null}

      <main
        className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-6 text-slate-50"
        style={{
          background:
            "radial-gradient(circle at 20% 0%, rgba(32, 232, 160, 0.16), transparent 28%), linear-gradient(180deg, #07111d 0%, #0b1730 55%, #0a1220 100%)"
        }}
      >
        {imageUrl ? (
          <img alt="Story card preview" className="block h-auto max-w-full rounded-xl shadow-[0_24px_80px_rgba(0,0,0,0.45)]" src={imageUrl} />
        ) : (
          <div className="max-w-sm rounded-2xl border border-white/10 bg-white/6 px-6 py-5 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <p className="text-base font-semibold">{rendering ? "Preparing your story card..." : "Could not load story card."}</p>
            <p className="mt-2 text-sm text-slate-300/80">
              {rendering ? "This should only take a moment." : "Go back and try again."}
            </p>
          </div>
        )}

        {profile ? (
          <div aria-hidden="true" className="pointer-events-none fixed left-[-99999px] top-0 opacity-0">
            <div ref={storyCardRef}>
              <ShareProfileStoryCard
                avatarUrl={profile.avatar_url}
                displayName={profile.display_name || profile.email}
                sections={shareSections}
              />
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}

type PickRow = {
  id: number;
  question_id: number;
  chapter_id: number;
  team_id: number;
};
