"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import AppHeader from "@/components/AppHeader";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import { prettyStatus, shortDate } from "@/lib/format";
import { supabase } from "@/lib/supabase-browser";
import type { Chapter, Pick, Profile, Question, Team } from "@/lib/types";
import { flagForCode } from "@/lib/flags";
import { useAuthResync } from "@/lib/useAuthResync";

type PickWithUser = Pick & {
  profiles: {
    display_name: string | null;
    email: string;
    is_admin: boolean;
  } | null;
};

function shortPlayerName(displayName: string | null, email: string | null) {
  const source = displayName?.trim() || email?.split("@")[0]?.trim() || "";
  if (!source) return "Player";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Player";
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase();
  return lastInitial ? `${firstName} ${lastInitial}.` : firstName;
}

export default function HomePage() {
  useAuthResync();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savingQuestion, setSavingQuestion] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [myPicks, setMyPicks] = useState<Pick[]>([]);
  const [allVisiblePicks, setAllVisiblePicks] = useState<PickWithUser[]>([]);
  const [gradedTeams, setGradedTeams] = useState<Map<number, Set<number>>>(new Map());
  const [notice, setNotice] = useState<{ text: string; tone: "neutral" | "success" | "danger" } | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(true);

  const loadPage = useCallback(async () => {
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
      setNotice({ text: "Could not load app data. Check your Supabase setup.", tone: "danger" });
      setLoading(false);
      return;
    }

    setProfile(profileRes.data);
    if (!profileRes.data.invite_code_used && !profileRes.data.is_admin) {
      router.replace("/invite");
      return;
    }

    const [chaptersRes, questionsRes, teamsRes, myPicksRes, resultTeamsRes] = await Promise.all([
      supabase.from("chapters").select("id,slug,name,status,opens_at,locks_at").order("id"),
      supabase.from("questions").select("id,chapter_id,prompt,order_index,points,short_label,is_active").eq("is_active", true).order("chapter_id").order("order_index"),
      supabase.from("teams").select("id,name,code").order("name"),
      supabase.from("picks").select("id,user_id,question_id,chapter_id,team_id,created_at,updated_at").eq("user_id", session.user.id),
      supabase.from("result_teams").select("question_id,team_id")
    ]);

    if (chaptersRes.error || questionsRes.error || teamsRes.error || myPicksRes.error || resultTeamsRes.error) {
      setNotice({ text: "Could not load app data. Check your Supabase setup.", tone: "danger" });
      setLoading(false);
      return;
    }
    setChapters(chaptersRes.data ?? []);
    setQuestions(questionsRes.data ?? []);
    setTeams(teamsRes.data ?? []);
    setMyPicks(myPicksRes.data ?? []);

    const nextGraded = new Map<number, Set<number>>();
    for (const row of resultTeamsRes.data ?? []) {
      const set = nextGraded.get(row.question_id) ?? new Set<number>();
      set.add(row.team_id);
      nextGraded.set(row.question_id, set);
    }
    setGradedTeams(nextGraded);

    const lockedIds = (chaptersRes.data ?? []).filter((c) => c.status !== "open" && c.status !== "draft").map((c) => c.id);

    if (lockedIds.length > 0) {
      const visiblePicksRes = await supabase
        .from("picks")
        .select("id,user_id,question_id,chapter_id,team_id,created_at,updated_at")
        .in("chapter_id", lockedIds);
      if (!visiblePicksRes.error) {
        const rawPicks = (visiblePicksRes.data ?? []) as Pick[];
        const userIds = Array.from(new Set(rawPicks.map((pick) => pick.user_id)));
        const visibleProfilesRes =
          userIds.length > 0
            ? await supabase.from("profiles").select("id,display_name,email,is_admin").in("id", userIds)
            : { data: [], error: null };

        const profileMap = new Map(
          (visibleProfilesRes.data ?? []).map((visibleProfile) => [visibleProfile.id, visibleProfile])
        );

        setAllVisiblePicks(
          rawPicks
            .map((pick) => ({
              ...pick,
              profiles: profileMap.get(pick.user_id) ?? null
            }))
            .filter((pick) => !pick.profiles?.is_admin)
        );
      }
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  function chapterQuestions(chapterId: number) {
    return questions.filter((q) => q.chapter_id === chapterId);
  }

  function myPickForQuestion(questionId: number) {
    return myPicks.find((p) => p.question_id === questionId);
  }

  function usedTeamIdsByChapter(chapterId: number, ignoreQuestionId?: number) {
    return new Set(
      myPicks.filter((p) => p.chapter_id === chapterId && p.question_id !== ignoreQuestionId).map((p) => p.team_id)
    );
  }

  async function savePick(chapter: Chapter, question: Question, rawTeamId: string) {
    if (chapter.status !== "open") {
      setNotice({ text: "This chapter is not open for picks.", tone: "danger" });
      return;
    }

    const teamId = Number(rawTeamId);
    const used = usedTeamIdsByChapter(chapter.id, question.id);
    if (used.has(teamId)) {
      setNotice({ text: "That team has already been used in this chapter.", tone: "danger" });
      return;
    }

    setSavingQuestion(question.id);
    setNotice(null);

    const res = await supabase.from("picks").upsert(
      {
        user_id: user?.id,
        question_id: question.id,
        chapter_id: chapter.id,
        team_id: teamId
      },
      { onConflict: "user_id,question_id" }
    );

    if (res.error) {
      setNotice({ text: res.error.message, tone: "danger" });
      setSavingQuestion(null);
      return;
    }

    const refreshed = await supabase
      .from("picks")
      .select("id,user_id,question_id,chapter_id,team_id,created_at,updated_at")
      .eq("user_id", user?.id ?? "");
    if (!refreshed.error) {
      setMyPicks(refreshed.data ?? []);
    }

    setNotice({ text: "Pick saved.", tone: "success" });
    setSavingQuestion(null);
  }

  async function clearPick(chapter: Chapter, question: Question) {
    if (chapter.status !== "open") {
      setNotice({ text: "This chapter is not open for picks.", tone: "danger" });
      return;
    }

    setSavingQuestion(question.id);
    setNotice(null);

    const res = await supabase
      .from("picks")
      .delete()
      .eq("user_id", user?.id ?? "")
      .eq("question_id", question.id);

    if (res.error) {
      setNotice({ text: res.error.message, tone: "danger" });
      setSavingQuestion(null);
      return;
    }

    const refreshed = await supabase
      .from("picks")
      .select("id,user_id,question_id,chapter_id,team_id,created_at,updated_at")
      .eq("user_id", user?.id ?? "");
    if (!refreshed.error) {
      setMyPicks(refreshed.data ?? []);
    }

    setNotice({ text: "Pick cleared.", tone: "success" });
    setSavingQuestion(null);
  }

  if (loading) {
    return <Loading label="Loading your league..." />;
  }

  return (
    <>
      <AppHeader user={user} isAdmin={Boolean(profile?.is_admin)} />

      {notice ? <div className="mb-4"><Notice text={notice.text} tone={notice.tone} /></div> : null}

      {showHowItWorks ? (
        <section className="glass mb-6 rounded-2xl p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="section-title">How It Works</h2>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs uppercase tracking-[0.14em] text-slate-200 hover:bg-white/10"
                onClick={() => setShowHowItWorks(false)}
                type="button"
              >
                Hide
              </button>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-slate-200/90">
            <li>Pick one team per question. Each team can be used only once per stage.</li>
            <li>Stages open one at a time. Group Stage picks due by June 8th, Knockout Stage picks due by June 28th.</li>
            <li>Picks lock and become visible to all participants after the due date.</li>
            <li>Correct answer point value varies by quesiton.</li>
            <li>
              One entry per person -- $40 fee to enter.{" "}
              <a
                className="inline-flex items-center rounded-md border border-cyan-200/40 bg-cyan-200/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100 hover:bg-cyan-200/20"
                href="/payment"
              >
                Venmo
              </a>
            </li>
          </ul>
        </section>
      ) : null}

      {chapters.map((chapter) => {
        const qs = chapterQuestions(chapter.id);
        const chapterVisible = chapter.status !== "open" && chapter.status !== "draft";

        return (
          <section className="glass mb-6 rounded-2xl p-4" key={chapter.id}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="section-title">{chapter.name}</h2>
                <p className="text-xs text-slate-400 whitespace-pre-line">
                  {chapter.status === "open"
                    ? chapter.slug === "knockout-stage"
                      ? "Picks are open. Picks due by June 28th."
                      : "Picks are open. Picks due by June 8th."
                    : chapter.status === "locked"
                      ? "Picks revealed."
                      : chapter.slug === "knockout-stage"
                        ? "Not open yet. Picks will open June 19th.\nPicks due by June 28th."
                        : "Not open yet."}
                  {chapter.opens_at ? ` Opens: ${shortDate(chapter.opens_at)}.` : ""}
                  {chapter.locks_at ? ` Locks: ${shortDate(chapter.locks_at)}.` : ""}
                </p>
              </div>
              <span className="chip">{prettyStatus(chapter.status)}</span>
            </div>

            <div className="space-y-4">
              {qs.map((q) => {
                const pick = myPickForQuestion(q.id);
                const used = usedTeamIdsByChapter(chapter.id, q.id);

                return (
                  <article className="rounded-xl border border-white/15 bg-white/5 p-3" key={q.id}>
                    <p className="mb-2 text-sm text-slate-200">
                      Q{q.order_index}: {q.prompt} <span className="text-xs text-slate-400">({q.points} pts)</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="min-w-[240px] rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm"
                        value={pick?.team_id ?? ""}
                        disabled={chapter.status !== "open" || savingQuestion === q.id}
                        onChange={(e) => void savePick(chapter, q, e.target.value)}
                      >
                        <option value="" disabled>
                          Select team
                        </option>
                        {teams.map((team) => {
                          const blocked = used.has(team.id);
                          const flag = flagForCode(team.code);
                          return (
                            <option disabled={blocked} key={team.id} value={team.id}>
                              {flag ? `${flag} ` : ""}{team.name} {blocked ? "(used)" : ""}
                            </option>
                          );
                        })}
                      </select>

                      <p className="text-xs text-slate-400">
                        {pick ? `Your pick: ${teamMap.get(pick.team_id)?.name ?? "Unknown"}` : "No pick yet"}
                      </p>

                      {pick ? (
                        <button
                          className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200 hover:bg-white/15"
                          type="button"
                          disabled={chapter.status !== "open" || savingQuestion === q.id}
                          onClick={() => void clearPick(chapter, q)}
                        >
                          Clear Pick
                        </button>
                      ) : null}
                    </div>

                    {chapterVisible ? (
                      <div className="mt-3 rounded-lg border border-cyan-100/20 bg-cyan-400/5 p-2">
                        <p className="mb-2 text-xs uppercase tracking-[0.16em] text-cyan-100/80">Individual Picks Revealed</p>
                        <ul className="grid gap-1 text-sm text-slate-200">
                          {allVisiblePicks
                            .filter((p) => p.question_id === q.id)
                            .map((p) => (
                              <li key={p.id}>
                                {(() => {
                                  return `${shortPlayerName(p.profiles?.display_name ?? null, p.profiles?.email ?? null)}: `;
                                })()}
                                {(() => {
                                  const team = teamMap.get(p.team_id);
                                  if (!team) return "Unknown";
                                  const flag = flagForCode(team.code);
                                  const winners = gradedTeams.get(q.id);
                                  const isGraded = chapter.status === "graded" && winners;
                                  const isCorrect = Boolean(winners?.has(p.team_id));
                                  const marker = isGraded ? (isCorrect ? " ✅" : " ❌") : "";
                                  return `${flag ? flag + " " : ""}${team.name}${marker}`;
                                })()}
                              </li>
                            ))}
                        </ul>
                      </div>
                    ) : null}
                  </article>
                );
              })}

            </div>
          </section>
        );
      })}
    </>
  );
}
