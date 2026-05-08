"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import AppHeader from "@/components/AppHeader";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import { supabase } from "@/lib/supabase-browser";
import { useAuthResync } from "@/lib/useAuthResync";
import { flagForCode } from "@/lib/flags";

export default function PlayerProfilePage() {
  useAuthResync();
  const params = useParams();
  const profileKey = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [payload, setPayload] = useState<PublicProfilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session) {
      setUser(session.user);
      const viewerRes = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!viewerRes.error) {
        setIsAdmin(Boolean(viewerRes.data?.is_admin));
      }
    }

    const publicProfileRes = await supabase.rpc("public_player_profile", { profile_key: profileKey });

    if (publicProfileRes.error || !publicProfileRes.data) {
      setError("Could not load player profile.");
      setLoading(false);
      return;
    }

    setPayload(publicProfileRes.data as PublicProfilePayload);

    setLoading(false);
  }, [profileKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const groupWinners = useMemo(() => payload?.revealed.group_winners ?? [], [payload?.revealed.group_winners]);
  const additionalQualifiers = useMemo(
    () => payload?.revealed.additional_qualifiers ?? [],
    [payload?.revealed.additional_qualifiers]
  );
  const groupStageRevealed = Boolean(payload?.revealed.group_stage_revealed);

  if (loading) return <Loading label="Loading player profile..." />;

  return (
    <>
      <AppHeader user={user} isAdmin={isAdmin} />
      {error ? <Notice text={error} tone="danger" /> : null}

      {payload ? (
        <section className="glass rounded-2xl p-6">
          <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">
              The following announcement has been paid for by{" "}
              <Image
                alt="OWS"
                className="mx-1 inline-block h-5 w-5 rounded-sm object-contain align-middle"
                src="/ows-nwo-logo.png"
                width={20}
                height={20}
              />
              :
            </p>
            <p className="text-sm leading-7 text-slate-200">
              Welcome to the{" "}
              <Image
                alt="Super League"
                className="mx-1 inline-block h-auto w-32 align-middle object-contain"
                src="/superleague-wordmark.png"
                width={128}
                height={32}
              />{" "}
              {"--"} a place where a group of otherwise ordinary individuals came together to predict the outcomes of
              the 2026 World Cup.
            </p>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-4">
            {payload.profile.avatar_url ? (
              <Image
                alt="Player avatar"
                className="h-20 w-20 rounded-full object-cover"
                src={payload.profile.avatar_url}
                width={80}
                height={80}
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">
                {(payload.profile.display_name || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{payload.profile.display_name}</h1>
              {payload.profile.shit_talk ? <p className="text-sm text-slate-200">{payload.profile.shit_talk}</p> : null}
            </div>
          </div>

          {payload.profile.allegiance_team_name && payload.profile.allegiance_team_code ? (
            <div className="mb-4 rounded-xl border border-cyan-200/20 bg-cyan-200/8 p-5">
              <p className="mb-1 text-xs uppercase tracking-[0.14em] text-slate-400">My Allegiance</p>
              <p className="text-xl font-semibold text-slate-100">
                {flagForCode(payload.profile.allegiance_team_code)} {payload.profile.allegiance_team_name}
              </p>
            </div>
          ) : null}

          {groupStageRevealed ? (
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                  <p className="mb-1 text-xs uppercase tracking-[0.14em] text-slate-400">Group Stage Pick For Tourney Winner</p>
                  <p className="text-sm text-slate-200">
                    {payload.revealed.champion ? `${flagForCode(payload.revealed.champion.code)} ${payload.revealed.champion.name}` : "No pick"}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                  <p className="mb-1 text-xs uppercase tracking-[0.14em] text-slate-400">Group Winners</p>
                  <p className="text-sm text-slate-200">
                    {groupWinners[0] ? `${flagForCode(groupWinners[0].code)} ${groupWinners[0].name}` : "No pick"}
                  </p>
                  <p className="text-sm text-slate-200">
                    {groupWinners[1] ? `${flagForCode(groupWinners[1].code)} ${groupWinners[1].name}` : "No pick"}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3 md:col-span-2">
                  <p className="mb-1 text-xs uppercase tracking-[0.14em] text-slate-400">Additional Knockout Stage Qualifiers</p>
                  <p className="text-sm text-slate-200">
                    {additionalQualifiers[0] ? `${flagForCode(additionalQualifiers[0].code)} ${additionalQualifiers[0].name}` : "No pick"}
                  </p>
                  <p className="text-sm text-slate-200">
                    {additionalQualifiers[1] ? `${flagForCode(additionalQualifiers[1].code)} ${additionalQualifiers[1].name}` : "No pick"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-base font-semibold text-slate-100">
                This player&apos;s picks are locked away for now. Check back after Group Stage closes to see their picks.
              </p>
              <p className="mt-3 text-sm text-slate-300">
                Do you want to join the party? Sign up using your invite code at{" "}
                <a className="text-cyan-200 underline underline-offset-2 hover:text-cyan-100" href="https://superleague.party">
                  superleague.party
                </a>
                .
              </p>
            </div>
          )}

        </section>
      ) : null}
    </>
  );
}

type PlayerProfile = {
  id: string;
  display_name: string;
  public_slug: string | null;
  avatar_url: string | null;
  allegiance_team_id: number | null;
  allegiance_team_name: string | null;
  allegiance_team_code: string | null;
  shit_talk: string | null;
};

type TeamSummary = {
  name: string;
  code: string;
};

type PublicProfilePayload = {
  profile: PlayerProfile;
  standing: {
    total_points: number;
    correct_picks: number;
    side_bets_wins: number;
    side_bets_losses: number;
  };
  revealed: {
    group_stage_revealed: boolean;
    champion: TeamSummary | null;
    group_winners: TeamSummary[];
    additional_qualifiers: TeamSummary[];
  };
};
