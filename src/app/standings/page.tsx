"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import AppHeader from "@/components/AppHeader";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import { supabase } from "@/lib/supabase-browser";
import { flagForCode } from "@/lib/flags";
import Image from "next/image";
import type { Chapter, Profile, Question, StandingRow, Team } from "@/lib/types";
import { useAuthResync } from "@/lib/useAuthResync";

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

export default function StandingsPage() {
  useAuthResync();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [profileAvatars, setProfileAvatars] = useState<Record<string, string>>({});
  const [profileSlugs, setProfileSlugs] = useState<Record<string, string>>({});
  const [profileShitTalk, setProfileShitTalk] = useState<Record<string, string>>({});
  const [profileShitTalkUpdatedAt, setProfileShitTalkUpdatedAt] = useState<Record<string, string>>({});
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [visiblePicks, setVisiblePicks] = useState<PickWithUser[]>([]);
  const [detail, setDetail] = useState<{ chapterId: number; teamId: number; top: number } | null>(null);
  const [talkDetail, setTalkDetail] = useState<{ userId: string; top: number } | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [showPointsAvailable, setShowPointsAvailable] = useState(true);
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

    const profileRes = await supabase
      .from("profiles")
      .select("id,email,display_name,public_slug,avatar_url,shit_talk,shit_talk_updated_at,invite_code_used,invite_approved_at,is_admin")
      .eq("id", session.user.id)
      .single();

    if (profileRes.error) {
      setError("Could not load standings. Ensure SQL view standings_live exists.");
      setLoading(false);
      return;
    }

    setProfile(profileRes.data);
    if (!profileRes.data.invite_code_used && !profileRes.data.is_admin) {
      router.replace("/invite");
      return;
    }

    const [standingsRes, chaptersRes, questionsRes, teamsRes, avatarsRes] = await Promise.all([
      supabase.from("standings_live").select("user_id,display_name,total_points,correct_picks,total_picks").order("total_points", { ascending: false }),
      supabase.from("chapters").select("id,slug,name,status,opens_at,locks_at").order("id"),
      supabase.from("questions").select("id,chapter_id,prompt,order_index,points,short_label,is_active").order("chapter_id").order("order_index"),
      supabase.from("teams").select("id,name,code,is_active").order("name"),
      supabase.from("profiles").select("id,public_slug,avatar_url,shit_talk,shit_talk_updated_at")
    ]);

    if (standingsRes.error || chaptersRes.error || questionsRes.error || teamsRes.error || avatarsRes.error) {
      setError("Could not load standings. Ensure SQL view standings_live exists.");
      setLoading(false);
      return;
    }
    setRows(standingsRes.data ?? []);
    setChapters(chaptersRes.data ?? []);
    setQuestions(questionsRes.data ?? []);
    setTeams(teamsRes.data ?? []);
    const avatarMap: Record<string, string> = {};
    const slugMap: Record<string, string> = {};
    const talkMap: Record<string, string> = {};
    const talkUpdatedMap: Record<string, string> = {};
    for (const p of avatarsRes.data ?? []) {
      if (p.public_slug) {
        slugMap[p.id] = p.public_slug;
      }
      if (p.avatar_url) {
        avatarMap[p.id] = p.avatar_url;
      }
      if (p.shit_talk) {
        talkMap[p.id] = p.shit_talk;
      }
      if (p.shit_talk_updated_at) {
        talkUpdatedMap[p.id] = p.shit_talk_updated_at;
      }
    }
    setProfileAvatars(avatarMap);
    setProfileSlugs(slugMap);
    setProfileShitTalk(talkMap);
    setProfileShitTalkUpdatedAt(talkUpdatedMap);

    const lockedIds = (chaptersRes.data ?? []).filter((c) => c.status !== "open" && c.status !== "draft").map((c) => c.id);
    if (lockedIds.length) {
      const picksRes = await supabase
        .from("picks")
        .select("id,user_id,question_id,chapter_id,team_id,created_at,updated_at")
        .in("chapter_id", lockedIds);
      if (!picksRes.error) {
        const rawPicks = (picksRes.data ?? []) as PickWithUser[];
        const userIds = Array.from(new Set(rawPicks.map((pick) => pick.user_id)));
        const visibleProfilesRes =
          userIds.length > 0
            ? await supabase.from("profiles").select("id,display_name,email,is_admin").in("id", userIds)
            : { data: [], error: null };

        const profileMap = new Map(
          (visibleProfilesRes.data ?? []).map((visibleProfile) => [visibleProfile.id, visibleProfile])
        );

        setVisiblePicks(
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
    void load();
  }, [load]);

  if (loading) {
    return <Loading label="Loading standings..." />;
  }

  const seenKey = "shit_talk_seen_by_user";
  const seenMap: Record<string, number> = (() => {
    try {
      const raw = localStorage.getItem(seenKey);
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  })();

  const markSeen = (userId: string) => {
    const updatedAt = profileShitTalkUpdatedAt[userId];
    if (!updatedAt) return;
    const ts = new Date(updatedAt).getTime();
    const next = { ...seenMap, [userId]: ts };
    localStorage.setItem(seenKey, JSON.stringify(next));
  };

  const openTalkDetail = (event: MouseEvent<HTMLButtonElement>, userId: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const preferredTop = rect.bottom + 12;
    const top = Math.max(preferredTop, 16);
    setTalkDetail({ userId, top });
  };

  const popupTopForClick = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const preferredTop = rect.bottom + 12;
    return Math.max(preferredTop, 16);
  };

  return (
    <>
      <AppHeader user={user} isAdmin={Boolean(profile?.is_admin)} />

      {error ? (
        <Notice text={error} tone="danger" />
      ) : (
        <section className="glass rounded-2xl p-4">
          {showPointsAvailable ? (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="font-semibold uppercase tracking-[0.14em] text-slate-200">Points available</p>
                <button
                  className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-200 hover:bg-white/10"
                  type="button"
                  onClick={() => setShowPointsAvailable(false)}
                >
                  Hide
                </button>
              </div>
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
          ) : null}
          <h2 className="section-title mb-4 flex items-center gap-2">
            <Image
              alt="Super League wordmark"
              className="h-auto w-28 max-w-full object-contain"
              src="/superleague-wordmark.png"
              width={112}
              height={28}
            />
            <span>Standings</span>
          </h2>
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
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const updatedAt = profileShitTalkUpdatedAt[row.user_id];
                          const updatedTs = updatedAt ? new Date(updatedAt).getTime() : 0;
                          const seenTs = seenMap[row.user_id] || 0;
                          const hasTalk = Boolean(profileShitTalk[row.user_id]);
                          const hasNew = updatedTs > seenTs && hasTalk;
                          const ring = hasNew ? "ring-2 ring-emerald-400/90 ring-offset-2 ring-offset-slate-900/70" : "";
                          return (
                            <button
                              type="button"
                              onClick={(event) => {
                                if (!hasTalk) return;
                                openTalkDetail(event, row.user_id);
                              }}
                              disabled={!hasTalk}
                              className={`rounded-full ${ring}`}
                            >
                          {profileAvatars[row.user_id] ? (
                            <Image
                              alt="Player avatar"
                              className="h-7 w-7 rounded-full object-cover"
                              src={profileAvatars[row.user_id]}
                              width={28}
                              height={28}
                            />
                          ) : (
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold">
                              {(row.display_name || "P").slice(0, 1).toUpperCase()}
                            </span>
                          )}
                            </button>
                          );
                        })()}
                        <a
                          className="text-left text-slate-100 underline decoration-white/20 hover:decoration-white"
                          href={`/players/${profileSlugs[row.user_id] || row.user_id}`}
                        >
                          {row.display_name || "Player"}
                        </a>
                      </div>
                    </td>
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
                <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3 md:col-span-2">
                  <p className="mb-2 text-sm font-semibold text-slate-200">Shit Talk</p>
                  <p className="text-sm text-slate-300">{profileShitTalk[selectedPlayerId] || "No shit has been talked yet."}</p>
                </div>
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
                              onClick={(event) =>
                                setDetail({ chapterId: chapter.id, teamId: team.id, top: popupTopForClick(event) })
                              }
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
              className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-4"
              onClick={() => setDetail(null)}
            >
              <div
                className="glass mx-auto w-full max-w-md overflow-y-auto rounded-2xl p-5"
                style={{
                  marginTop: `${detail.top}px`,
                  marginBottom: "16px",
                  maxHeight: `calc(100vh - ${detail.top + 16}px)`
                }}
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
                            {`${shortPlayerName(p.profiles?.display_name ?? null, p.profiles?.email ?? null)} (${label})`}
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

          {talkDetail ? (
            <div
              className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-4"
              onClick={() => setTalkDetail(null)}
            >
              <div
                className="glass mx-auto w-full max-w-md overflow-y-auto rounded-2xl p-5"
                style={{
                  marginTop: `${talkDetail.top}px`,
                  marginBottom: "16px",
                  maxHeight: `calc(100vh - ${talkDetail.top + 16}px)`
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {(() => {
                  const row = rows.find((r) => r.user_id === talkDetail.userId);
                  const message = profileShitTalk[talkDetail.userId] || "—";
                  return (
                    <>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {profileAvatars[talkDetail.userId] ? (
                            <Image
                              alt="Player avatar"
                              className="h-10 w-10 rounded-full object-cover"
                              src={profileAvatars[talkDetail.userId]}
                              width={40}
                              height={40}
                            />
                          ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                              {(row?.display_name || "P").slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div>
                            <h3 className="text-base font-semibold">{row?.display_name || "Player"}</h3>
                            <p className="text-xs text-slate-400">Shit Talk</p>
                          </div>
                        </div>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => {
                            markSeen(talkDetail.userId);
                            setTalkDetail(null);
                          }}
                        >
                          Close
                        </button>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200">
                        {message}
                      </div>
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
    is_admin: boolean;
  } | null;
};
