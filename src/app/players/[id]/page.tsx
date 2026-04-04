"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import AppHeader from "@/components/AppHeader";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import { supabase } from "@/lib/supabase-browser";
import { useAuthResync } from "@/lib/useAuthResync";
import type { Chapter, Question, Team, StandingRow } from "@/lib/types";
import { flagForCode } from "@/lib/flags";

export default function PlayerProfilePage() {
  useAuthResync();
  const router = useRouter();
  const params = useParams();
  const userId = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [standing, setStanding] = useState<StandingRow | null>(null);
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

    const [viewerRes, profileRes, chaptersRes, questionsRes, teamsRes, standingRes] = await Promise.all([
      supabase.from("profiles").select("is_admin").eq("id", session.user.id).single(),
      supabase
        .from("profiles")
        .select("id,email,display_name,avatar_url,shit_talk")
        .eq("id", userId)
        .single(),
      supabase.from("chapters").select("id,slug,name,status,opens_at,locks_at").order("id"),
      supabase.from("questions").select("id,chapter_id,prompt,order_index,points,short_label,is_active").order("chapter_id").order("order_index"),
      supabase.from("teams").select("id,name,code").order("name"),
      supabase.from("standings_live").select("user_id,display_name,total_points,correct_picks,total_picks").eq("user_id", userId).maybeSingle()
    ]);

    if (viewerRes.error || profileRes.error || chaptersRes.error || questionsRes.error || teamsRes.error) {
      setError("Could not load player profile.");
      setLoading(false);
      return;
    }

    setIsAdmin(Boolean(viewerRes.data?.is_admin));
    setProfile(profileRes.data as PlayerProfile);
    setChapters(chaptersRes.data ?? []);
    setQuestions(questionsRes.data ?? []);
    setTeams(teamsRes.data ?? []);
    setStanding(standingRes.data ?? null);

    const lockedIds = (chaptersRes.data ?? [])
      .filter((c) => c.status === "locked" || c.status === "graded")
      .map((c) => c.id);

    if (lockedIds.length) {
      const picksRes = await supabase
        .from("picks")
        .select("id,question_id,chapter_id,team_id")
        .eq("user_id", userId)
        .in("chapter_id", lockedIds);
      if (!picksRes.error) {
        setPicks((picksRes.data ?? []) as PickRow[]);
      }
    } else {
      setPicks([]);
    }

    setLoading(false);
  }, [router, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  if (loading) return <Loading label="Loading player profile..." />;

  return (
    <>
      <AppHeader user={user} isAdmin={isAdmin} />
      {error ? <Notice text={error} tone="danger" /> : null}

      {profile ? (
        <section className="glass rounded-2xl p-6">
          <div className="mb-6 flex flex-wrap items-center gap-4">
            {profile.avatar_url ? (
              <Image
                alt="Player avatar"
                className="h-20 w-20 rounded-full object-cover"
                src={profile.avatar_url}
                width={80}
                height={80}
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">
                {(profile.display_name || profile.email || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{profile.display_name || profile.email}</h1>
              <p className="text-sm text-slate-200">{profile.shit_talk || "—"}</p>
            </div>
          </div>

          {standing ? (
            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              <StatCard label="Points" value={standing.total_points} />
              <StatCard label="Correct" value={standing.correct_picks} />
              <StatCard label="Picks" value={standing.total_picks} />
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            {chapters
              .filter((c) => c.status === "locked" || c.status === "graded")
              .map((chapter) => (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4" key={chapter.id}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">
                    {chapter.name}
                  </h3>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {questions
                      .filter((q) => q.chapter_id === chapter.id)
                      .map((q) => {
                        const pick = picks.find((p) => p.question_id === q.id);
                        const team = pick ? teamMap.get(pick.team_id) : null;
                        return (
                          <li key={`player-${chapter.id}-${q.id}`}>
                            Q{q.order_index} ({q.short_label || q.prompt}): {team ? `${flagForCode(team.code)} ${team.name}` : "No pick"}
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}

type PlayerProfile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  shit_talk: string | null;
};

type PickRow = {
  id: number;
  question_id: number;
  chapter_id: number;
  team_id: number;
};
