"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import AppHeader from "@/components/AppHeader";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import { supabase } from "@/lib/supabase-browser";
import { flagForCode } from "@/lib/flags";
import type { Chapter, Profile, Question, StandingRow, Team } from "@/lib/types";
import { useAuthResync } from "@/lib/useAuthResync";

export default function StandingsPage() {
  useAuthResync();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [visiblePicks, setVisiblePicks] = useState<PickWithUser[]>([]);
  const [detail, setDetail] = useState<{ chapterId: number; teamId: number } | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

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

    const [profileRes, standingsRes, chaptersRes, questionsRes, teamsRes] = await Promise.all([
      supabase.from("profiles").select("id,email,display_name,is_admin").eq("id", session.user.id).single(),
      supabase.from("standings_live").select("user_id,display_name,total_points,correct_picks,total_picks").order("total_points", { ascending: false }),
      supabase.from("chapters").select("id,slug,name,status,opens_at,locks_at").order("id"),
      supabase.from("questions").select("id,chapter_id,prompt,order_index,points,short_label,is_active").order("chapter_id").order("order_index"),
      supabase.from("teams").select("id,name,code").order("name")
    ]);

    if (profileRes.error || standingsRes.error || chaptersRes.error || questionsRes.error || teamsRes.error) {
      setError("Could not load standings. Ensure SQL view standings_live exists.");
      setLoading(false);
      return;
    }

    setProfile(profileRes.data);
    setRows(standingsRes.data ?? []);
    setChapters(chaptersRes.data ?? []);
    setQuestions(questionsRes.data ?? []);
    setTeams(teamsRes.data ?? []);

    const lockedIds = (chaptersRes.data ?? []).filter((c) => c.status !== "open" && c.status !== "draft").map((c) => c.id);
    if (lockedIds.length) {
      const picksRes = await supabase
        .from("picks")
        .select("id,user_id,question_id,chapter_id,team_id,created_at,updated_at,profiles(display_name,email)")
        .in("chapter_id", lockedIds);
      if (!picksRes.error) {
        setVisiblePicks((picksRes.data ?? []) as PickWithUser[]);
      }
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <Loading label="Loading standings..." />;
  }

  return (
    <>
      <AppHeader user={user} isAdmin={Boolean(profile?.is_admin)} />

      {error ? (
        <Notice text={error} tone="danger" />
      ) : (
        <section className="glass rounded-2xl p-4">
          <h2 className="section-title mb-4">League Standings</h2>
          <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
            <p className="mb-1 font-semibold uppercase tracking-[0.14em] text-slate-200">Points available</p>
            {chapters.map((chapter) => {
              const total = questions
                .filter((q) => q.chapter_id === chapter.id)
                .reduce((sum, q) => sum + (q.points ?? 0), 0);
              return (
                <p key={chapter.id}>
                  {chapter.name}: {total} pts
                </p>
              );
            })}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/20 text-slate-300">
                  <th className="px-2 py-2">Rank</th>
                  <th className="px-2 py-2">Player</th>
                  <th className="px-2 py-2">Points</th>
                  <th className="px-2 py-2">Correct</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr className="border-b border-white/10" key={row.user_id}>
                    <td className="px-2 py-2 font-semibold">{index + 1}</td>
                    <td className="px-2 py-2">{row.display_name || "Player"}</td>
                    <td className="px-2 py-2">{row.total_points}</td>
                    <td className="px-2 py-2">{row.correct_picks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {chapters.some((chapter) => chapter.slug === "group-stage" && (chapter.status === "locked" || chapter.status === "graded")) ? (
            <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">
                  Player Picks Lookup
                </h3>
                <span className="chip">View any player</span>
              </div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <select
                  className="min-w-[240px] rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm"
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                >
                  <option value="">Select player</option>
                  {rows.map((row) => (
                    <option key={row.user_id} value={row.user_id}>
                      {row.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPlayerId ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {chapters
                    .filter((chapter) => chapter.status === "locked" || chapter.status === "graded")
                    .map((chapter) => (
                    <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3" key={`player-${chapter.id}`}>
                      <p className="mb-2 text-sm font-semibold text-slate-200">{chapter.name}</p>
                      <ul className="space-y-1 text-sm text-slate-300">
                        {questions
                          .filter((q) => q.chapter_id === chapter.id)
                          .map((q) => {
                            const pick = visiblePicks.find(
                              (p) => p.user_id === selectedPlayerId && p.question_id === q.id
                            );
                            const team = pick ? teams.find((t) => t.id === pick.team_id) : null;
                            return (
                            <li key={`player-${chapter.id}-${q.id}`}>
                              Q{q.order_index} ({q.short_label || q.prompt}):{" "}
                              {team ? `${flagForCode(team.code)} ${team.name}` : "No pick"}
                            </li>
                            );
                          })}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Select a player to view their picks.</p>
              )}
            </section>
          ) : null}

          {chapters
            .filter((chapter) => chapter.status !== "open" && chapter.status !== "draft")
            .map((chapter) => (
              <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3" key={`summary-${chapter.id}`}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">
                    {chapter.name} Summary
                  </h3>
                  <span className="chip">Most picked teams</span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {teams
                    .map((team) => ({
                      team,
                      count: visiblePicks.filter((p) => p.chapter_id === chapter.id && p.team_id === team.id).length
                    }))
                    .filter((item) => item.count > 0)
                    .sort((a, b) => b.count - a.count)
                    .map(({ team, count }) => {
                      const flag = flagForCode(team.code);
                      return (
                        <div
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm"
                          key={`summary-${chapter.id}-${team.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{flag}</span>
                            <button
                              className="text-left text-slate-100 underline decoration-white/20 hover:decoration-white"
                              type="button"
                              onClick={() => setDetail({ chapterId: chapter.id, teamId: team.id })}
                            >
                              {team.name}
                            </button>
                          </div>
                          <span className="rounded-full bg-cyan-300/20 px-2 py-0.5 text-xs font-semibold text-cyan-100">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </section>
            ))}

          {detail ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
              onClick={() => setDetail(null)}
            >
              <div
                className="glass w-full max-w-md rounded-2xl p-5"
                onClick={(e) => e.stopPropagation()}
              >
                {(() => {
                  const chapter = chapters.find((c) => c.id === detail.chapterId);
                  const team = teams.find((t) => t.id === detail.teamId);
                  const picks = visiblePicks.filter(
                    (p) => p.chapter_id === detail.chapterId && p.team_id === detail.teamId
                  );
                  return (
                    <>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-lg font-semibold">
                          {chapter?.name} — {team?.name}
                        </h3>
                        <button className="btn btn-secondary" type="button" onClick={() => setDetail(null)}>
                          Close
                        </button>
                      </div>
                      <ul className="space-y-1 text-sm text-slate-200">
                        {picks.map((p) => {
                          const q = questions.find((q) => q.id === p.question_id);
                          const label = q?.short_label || q?.prompt || "Question";
                          return (
                          <li key={p.id}>
                            {(() => {
                              const profile = Array.isArray(p.profiles) ? p.profiles[0] : null;
                              return (profile?.display_name || profile?.email || "Player") + ` (${label})`;
                            })()}
                          </li>
                          );
                        })}
                      </ul>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : null}
        </section>
      )}
    </>
  );
}

type PickWithUser = {
  id: number;
  user_id: string;
  question_id: number;
  chapter_id: number;
  team_id: number;
  created_at: string;
  updated_at: string;
  profiles: {
    display_name: string | null;
    email: string;
  }[] | null;
};
