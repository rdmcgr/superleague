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

    const viewerRes = await supabase
      .from("profiles")
      .select("is_admin,invite_code_used,invite_approved_at")
      .eq("id", session.user.id)
      .single();

    if (viewerRes.error) {
      setError("Could not load player profile.");
      setLoading(false);
      return;
    }

    setIsAdmin(Boolean(viewerRes.data?.is_admin));
    if (!viewerRes.data?.invite_code_used && !viewerRes.data?.is_admin) {
      router.replace("/invite");
      return;
    }

    const [profileRes, chaptersRes, questionsRes, teamsRes, standingRes] = await Promise.all([
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

    if (profileRes.error || chaptersRes.error || questionsRes.error || teamsRes.error) {
      setError("Could not load player profile.");
      setLoading(false);
      return;
    }
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

          {(() => {
            const groupStage = chapters.find((c) => c.slug === "group-stage");
            const q1 = groupStage ? questions.find((q) => q.chapter_id === groupStage.id && q.order_index === 1) : null;
            const pick = q1 ? picks.find((p) => p.question_id === q1.id) : null;
            const team = pick ? teamMap.get(pick.team_id) : null;
            const groupClosed = Boolean(groupStage && (groupStage.status === "locked" || groupStage.status === "graded"));
            const q2 = groupStage ? questions.find((q) => q.chapter_id === groupStage.id && q.order_index === 2) : null;
            const q3 = groupStage ? questions.find((q) => q.chapter_id === groupStage.id && q.order_index === 3) : null;
            const q4 = groupStage ? questions.find((q) => q.chapter_id === groupStage.id && q.order_index === 4) : null;
            const q5 = groupStage ? questions.find((q) => q.chapter_id === groupStage.id && q.order_index === 5) : null;
            const pick2 = q2 ? picks.find((p) => p.question_id === q2.id) : null;
            const pick3 = q3 ? picks.find((p) => p.question_id === q3.id) : null;
            const pick4 = q4 ? picks.find((p) => p.question_id === q4.id) : null;
            const pick5 = q5 ? picks.find((p) => p.question_id === q5.id) : null;
            const team2 = pick2 ? teamMap.get(pick2.team_id) : null;
            const team3 = pick3 ? teamMap.get(pick3.team_id) : null;
            const team4 = pick4 ? teamMap.get(pick4.team_id) : null;
            const team5 = pick5 ? teamMap.get(pick5.team_id) : null;
            return (
              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                    <p className="mb-1 text-xs uppercase tracking-[0.14em] text-slate-400">Group Stage Pick For Tourney Winner</p>
                    <p className="text-sm text-slate-200">
                      {team ? `${flagForCode(team.code)} ${team.name}` : "No pick"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                    <p className="mb-1 text-xs uppercase tracking-[0.14em] text-slate-400">Group Winners</p>
                    <p className="text-sm text-slate-200">
                      {groupClosed && team2 ? `${flagForCode(team2.code)} ${team2.name}` : "No pick"}
                    </p>
                    <p className="text-sm text-slate-200">
                      {groupClosed && team3 ? `${flagForCode(team3.code)} ${team3.name}` : "No pick"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3 md:col-span-2">
                    <p className="mb-1 text-xs uppercase tracking-[0.14em] text-slate-400">Additional Knockout Stage Qualifiers</p>
                    <p className="text-sm text-slate-200">
                      {groupClosed && team4 ? `${flagForCode(team4.code)} ${team4.name}` : "No pick"}
                    </p>
                    <p className="text-sm text-slate-200">
                      {groupClosed && team5 ? `${flagForCode(team5.code)} ${team5.name}` : "No pick"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {standing ? (
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              <StatCard label="Points" value={standing.total_points} />
              <StatCard label="Correct" value={standing.correct_picks} />
            </div>
          ) : null}
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
