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

  if (loading) return <Loading label="Loading player profile..." />;

  return (
    <>
      <AppHeader user={user} isAdmin={isAdmin} />
      {error ? <Notice text={error} tone="danger" /> : null}

      {payload ? (
        <section className="glass rounded-2xl p-6">
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
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="mb-1 text-xs uppercase tracking-[0.14em] text-slate-400">My Allegiance</p>
              <p className="text-sm text-slate-200">
                {flagForCode(payload.profile.allegiance_team_code)} {payload.profile.allegiance_team_name}
              </p>
            </div>
          ) : null}

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
    champion: TeamSummary | null;
    group_winners: TeamSummary[];
    additional_qualifiers: TeamSummary[];
  };
};
