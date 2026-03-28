"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import AppHeader from "@/components/AppHeader";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import { prettyStatus } from "@/lib/format";
import { supabase } from "@/lib/supabase-browser";
import type { Chapter, Pick, Profile, Question, ResultTeam, Team } from "@/lib/types";
import { useAuthResync } from "@/lib/useAuthResync";

function buildGradeState(qs: Question[], rows: ResultTeam[]) {
  const next: Record<number, { teamIds: number[]; points: number }> = {};
  for (const q of qs) {
    next[q.id] = { teamIds: [], points: q.points ?? 10 };
  }
  for (const row of rows) {
    const existing = next[row.question_id];
    if (existing) {
      existing.teamIds.push(row.team_id);
      existing.points = row.points;
    } else {
      next[row.question_id] = { teamIds: [row.team_id], points: row.points };
    }
  }
  return next;
}

export default function AdminPage() {
  useAuthResync();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [allPicks, setAllPicks] = useState<Pick[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [gradeState, setGradeState] = useState<Record<number, { teamIds: number[]; points: number }>>({});
  const [notice, setNotice] = useState<{ text: string; tone: "neutral" | "success" | "danger" } | null>(null);

  const loadAdmin = useCallback(async () => {
    setLoading(true);

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    setUser(session.user);

    const [profileRes, chaptersRes, questionsRes, teamsRes, resultTeamsRes, profilesRes, picksRes] = await Promise.all([
      supabase.from("profiles").select("id,email,display_name,is_admin").eq("id", session.user.id).single(),
      supabase.from("chapters").select("id,slug,name,status,opens_at,locks_at").order("id"),
      supabase.from("questions").select("id,chapter_id,prompt,order_index,points,short_label,is_active").order("chapter_id").order("order_index"),
      supabase.from("teams").select("id,name,code").order("name"),
      supabase.from("result_teams").select("question_id,team_id,points"),
      supabase.from("profiles").select("id,email,display_name,is_admin").order("created_at"),
      supabase.from("picks").select("id,user_id,question_id,chapter_id,team_id,created_at,updated_at")
    ]);

    if (
      profileRes.error ||
      chaptersRes.error ||
      questionsRes.error ||
      teamsRes.error ||
      resultTeamsRes.error ||
      profilesRes.error ||
      picksRes.error
    ) {
      setNotice({ text: "Could not load admin data.", tone: "danger" });
      setLoading(false);
      return;
    }

    setProfile(profileRes.data);
    setChapters(chaptersRes.data ?? []);
    setQuestions(questionsRes.data ?? []);
    setTeams(teamsRes.data ?? []);
    setGradeState(buildGradeState(questionsRes.data ?? [], resultTeamsRes.data ?? []));
    setAllProfiles(profilesRes.data ?? []);
    setAllPicks(picksRes.data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void loadAdmin();
  }, [loadAdmin]);

  async function setChapterStatus(chapterId: number, status: Chapter["status"]) {
    setSaving(true);
    const res = await supabase.from("chapters").update({ status }).eq("id", chapterId);
    if (res.error) {
      setNotice({ text: res.error.message, tone: "danger" });
      setSaving(false);
      return;
    }
    setNotice({ text: "Chapter updated.", tone: "success" });
    await loadAdmin();
    setSaving(false);
  }

  async function updateQuestion(id: number, prompt: string, shortLabel: string | null) {
    setSaving(true);
    const res = await supabase.from("questions").update({ prompt, short_label: shortLabel }).eq("id", id);
    if (res.error) {
      setNotice({ text: res.error.message, tone: "danger" });
      setSaving(false);
      return;
    }
    setNotice({ text: "Question updated.", tone: "success" });
    await loadAdmin();
    setSaving(false);
  }

  async function createQuestion(chapterId: number) {
    const chapterQuestions = questions.filter((q) => q.chapter_id === chapterId);
    const nextOrder = chapterQuestions.length + 1;
    const res = await supabase.from("questions").insert({
      chapter_id: chapterId,
      prompt: `Placeholder question ${nextOrder}`,
      order_index: nextOrder,
      points: 10,
      is_active: true
    });
    if (res.error) {
      setNotice({ text: res.error.message, tone: "danger" });
      return;
    }
    setNotice({ text: "Question added.", tone: "success" });
    await loadAdmin();
  }

  function updateGradeTeams(questionId: number, teamIds: number[]) {
    setGradeState((prev) => ({
      ...prev,
      [questionId]: { teamIds, points: prev[questionId]?.points ?? 10 }
    }));
  }

  function updateGradePoints(questionId: number, points: number) {
    setGradeState((prev) => ({
      ...prev,
      [questionId]: { teamIds: prev[questionId]?.teamIds ?? [], points }
    }));
  }

  async function saveGrades(chapterId: number, markGraded: boolean) {
    const chapterQuestionIds = questions.filter((q) => q.chapter_id === chapterId).map((q) => q.id);
    setSaving(true);
    setNotice(null);

    const updates = chapterQuestionIds.map((qid) => {
      const state = gradeState[qid];
      if (!state) return null;
      return supabase.from("questions").update({ points: state.points }).eq("id", qid);
    }).filter(Boolean);

    if (updates.length) {
      const results = await Promise.all(updates);
      const firstError = results.find((r) => r && r.error)?.error;
      if (firstError) {
        setNotice({ text: firstError.message, tone: "danger" });
        setSaving(false);
        return;
      }
    }

    const delRes = await supabase.from("result_teams").delete().in("question_id", chapterQuestionIds);
    if (delRes.error) {
      setNotice({ text: delRes.error.message, tone: "danger" });
      setSaving(false);
      return;
    }

    const rows: ResultTeam[] = [];
    for (const qid of chapterQuestionIds) {
      const state = gradeState[qid];
      if (!state) continue;
      for (const teamId of state.teamIds) {
        rows.push({ question_id: qid, team_id: teamId, points: state.points || 10 });
      }
    }

    if (rows.length > 0) {
      const insRes = await supabase.from("result_teams").insert(rows);
      if (insRes.error) {
        setNotice({ text: insRes.error.message, tone: "danger" });
        setSaving(false);
        return;
      }
    }

    if (markGraded) {
      const gradeRes = await supabase.from("chapters").update({ status: "graded" }).eq("id", chapterId);
      if (gradeRes.error) {
        setNotice({ text: gradeRes.error.message, tone: "danger" });
        setSaving(false);
        return;
      }
    }

    setNotice({ text: markGraded ? "Grades saved and stage marked graded." : "Grades saved.", tone: "success" });
    await loadAdmin();
    setSaving(false);
  }

  if (loading) return <Loading label="Loading admin dashboard..." />;

  const isAdmin = Boolean(profile?.is_admin);

  return (
    <>
      <AppHeader user={user} isAdmin={isAdmin} />
      {notice ? <div className="mb-4"><Notice text={notice.text} tone={notice.tone} /></div> : null}

      {!isAdmin ? (
        <Notice text="You do not have admin access." tone="danger" />
      ) : (
        <div className="space-y-5">
          {chapters.map((chapter) => (
            <section className="glass rounded-2xl p-4" key={chapter.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="section-title">{chapter.name}</h2>
                  <p className="text-sm text-slate-300">Current status: {prettyStatus(chapter.status)}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    className={`btn ${chapter.status === "draft" ? "btn-primary" : "btn-secondary"}`}
                    disabled={saving}
                    onClick={() => void setChapterStatus(chapter.id, "draft")}
                    type="button"
                  >
                    Preview
                  </button>
                  <button
                    className={`btn ${chapter.status === "open" ? "btn-primary" : "btn-secondary"}`}
                    disabled={saving}
                    onClick={() => void setChapterStatus(chapter.id, "open")}
                    type="button"
                  >
                    Open
                  </button>
                  <button
                    className={`btn ${chapter.status === "locked" ? "btn-primary" : "btn-secondary"}`}
                    disabled={saving}
                    onClick={() => void setChapterStatus(chapter.id, "locked")}
                    type="button"
                  >
                    Lock & Reveal
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Total points this stage:{" "}
                  {questions
                    .filter((q) => q.chapter_id === chapter.id)
                    .reduce((sum, q) => sum + (q.points ?? 0), 0)}
                </p>
                {questions
                  .filter((q) => q.chapter_id === chapter.id)
                  .map((q) => (
                    <QuestionEditor key={q.id} question={q} onSave={updateQuestion} />
                  ))}

                <button className="btn btn-secondary" onClick={() => void createQuestion(chapter.id)} type="button">
                  + Add Question
                </button>
              </div>

              <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Grading</h3>
                <div className="space-y-4">
                  {questions
                    .filter((q) => q.chapter_id === chapter.id)
                    .map((q) => {
                      const state = gradeState[q.id] ?? { teamIds: [], points: 10 };
                      return (
                        <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3" key={`grade-${q.id}`}>
                          <p className="mb-2 text-sm text-slate-200">Q{q.order_index}: {q.prompt}</p>
                          <div className="flex flex-wrap items-center gap-3">
                            <WinnerPicker
                              teams={teams}
                              selectedIds={state.teamIds}
                              onChange={(next) => updateGradeTeams(q.id, next)}
                            />

                            <button
                              className="btn btn-secondary"
                              type="button"
                              onClick={() => updateGradeTeams(q.id, [])}
                            >
                              Clear Winners
                            </button>

                            <label className="text-xs text-slate-300">
                              Points
                              <input
                                className="mt-1 w-24 rounded-lg border border-white/15 bg-slate-950/60 px-2 py-1 text-sm"
                                type="number"
                                min={0}
                                value={state.points}
                                onChange={(e) => updateGradePoints(q.id, Number(e.target.value))}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn btn-secondary" disabled={saving} onClick={() => void saveGrades(chapter.id, false)} type="button">
                    Save Winners
                  </button>
                  <button className="btn btn-primary" disabled={saving} onClick={() => void saveGrades(chapter.id, true)} type="button">
                    Save & Mark Graded
                  </button>
                </div>
              </div>
            </section>
          ))}

          <section className="glass rounded-2xl p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="section-title">Player Completion</h2>
              <span className="chip">{questions.length} total questions</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/20 text-slate-300">
                    <th className="px-2 py-2">Player</th>
                    <th className="px-2 py-2">Picks Saved</th>
                    <th className="px-2 py-2">Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {allProfiles.map((p) => {
                    const count = allPicks.filter((pick) => pick.user_id === p.id).length;
                    const missing = Math.max(questions.length - count, 0);
                    return (
                      <tr className="border-b border-white/10" key={p.id}>
                        <td className="px-2 py-2">{p.display_name || p.email}</td>
                        <td className="px-2 py-2">{count}</td>
                        <td className="px-2 py-2">{missing}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function QuestionEditor({
  question,
  onSave
}: {
  question: Question;
  onSave: (id: number, prompt: string, shortLabel: string | null) => Promise<void>;
}) {
  const [text, setText] = useState(question.prompt);
  const [label, setLabel] = useState(question.short_label ?? "");

  useEffect(() => {
    setText(question.prompt);
    setLabel(question.short_label ?? "");
  }, [question.prompt, question.short_label]);

  return (
    <article className="rounded-xl border border-white/15 bg-white/5 p-3">
      <p className="mb-1 text-xs uppercase tracking-[0.16em] text-slate-400">Q{question.order_index}</p>
      <input
        className="mb-2 w-full rounded-lg border border-white/20 bg-slate-950/60 p-2 text-sm"
        placeholder="Short label (e.g., Group Winner)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <textarea
        className="mb-2 min-h-20 w-full rounded-lg border border-white/20 bg-slate-950/60 p-2 text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="btn btn-primary" onClick={() => void onSave(question.id, text, label || null)} type="button">
        Save Question
      </button>
    </article>
  );
}

function WinnerPicker({
  teams,
  selectedIds,
  onChange
}: {
  teams: Team[];
  selectedIds: number[];
  onChange: (next: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = teams.filter((t) => t.name.toLowerCase().startsWith(query.trim().toLowerCase()));
  const list = query.trim() ? filtered : teams;

  return (
    <div className="min-w-[260px]">
      <label className="text-xs text-slate-300">Winners (searchable)</label>
      <div className="relative">
        <input
          className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm"
          placeholder="Type team name"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 100);
          }}
        />
        {open ? (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-white/10 bg-slate-950/95 p-1 text-sm shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            {list.length ? (
              list.map((team) => {
                const selected = selectedIds.includes(team.id);
                return (
                  <button
                    key={team.id}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-white/10 ${selected ? "text-slate-500" : "text-slate-100"}`}
                    onClick={() => {
                      if (!selected) {
                        onChange([...selectedIds, team.id]);
                      }
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <span>{team.name}</span>
                    {selected ? <span className="text-xs uppercase tracking-[0.16em]">Selected</span> : null}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-xs text-slate-400">No matches.</div>
            )}
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {selectedIds.map((teamId) => {
          const team = teams.find((t) => t.id === teamId);
          if (!team) return null;
          return (
            <button
              key={`chip-${teamId}`}
              type="button"
              className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-white/15"
              onClick={() => onChange(selectedIds.filter((id) => id !== teamId))}
            >
              {team.name} ×
            </button>
          );
        })}
      </div>
    </div>
  );
}
