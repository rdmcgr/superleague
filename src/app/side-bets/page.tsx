"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import AppHeader from "@/components/AppHeader";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import { supabase } from "@/lib/supabase-browser";
import { flagForCode } from "@/lib/flags";
import type { Profile, SideBet, SideBetComment, Team } from "@/lib/types";
import { useAuthResync } from "@/lib/useAuthResync";

type BetRow = SideBet & {
  creator?: { display_name: string | null; email: string } | null;
  taker?: { display_name: string | null; email: string } | null;
};

type CommentRow = SideBetComment & {
  profiles?: { display_name: string | null; email: string } | null;
};

const STAKE_MIN = 1;
const STAKE_MAX = 5000;
const SPREAD_MIN = -9.5;
const SPREAD_MAX = 9.5;

const SPREAD_OPTIONS = Array.from({ length: 20 }, (_, index) => {
  const value = SPREAD_MIN + index;
  const label = value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
  return { value: value.toFixed(1), label };
});

export default function SideBetsPage() {
  useAuthResync();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [bets, setBets] = useState<BetRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [teamA, setTeamA] = useState<string>("");
  const [teamB, setTeamB] = useState<string>("");
  const [betType, setBetType] = useState<"moneyline" | "spread">("moneyline");
  const [spreadTeam, setSpreadTeam] = useState<string>("");
  const [spreadValue, setSpreadValue] = useState<string>("");
  const [stake, setStake] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [editingBetId, setEditingBetId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<number | null>(null);

  const teamMap = useMemo(() => new Map(teams.map((t) => [String(t.id), t])), [teams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

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
      .select("id,email,display_name,avatar_url,shit_talk,shit_talk_updated_at,invite_code_used,invite_approved_at,is_admin")
      .eq("id", session.user.id)
      .single();

    if (profileRes.error) {
      setError("Could not load side bets.");
      setLoading(false);
      return;
    }

    setProfile(profileRes.data);
    if (!profileRes.data.invite_code_used && !profileRes.data.is_admin) {
      router.replace("/invite");
      return;
    }

    const [teamsRes, betsRes, commentsRes] = await Promise.all([
      supabase.from("teams").select("id,name,code").order("name"),
      supabase
        .from("side_bets")
        .select(
          "id,creator_id,taker_id,team_a_id,team_b_id,bet_type,spread_team_id,spread_value,stake_amount,description,status,creator_selected_winner_id,taker_selected_winner_id,winner_id,settled_at,created_at,creator:creator_id(display_name,email),taker:taker_id(display_name,email)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("side_bet_comments")
        .select("id,bet_id,user_id,message,created_at,profiles(display_name,email)")
        .order("created_at", { ascending: true })
    ]);

    if (teamsRes.error || betsRes.error || commentsRes.error) {
      setError("Could not load side bets.");
      setLoading(false);
      return;
    }

    setTeams(teamsRes.data ?? []);
    const normalizedBets = (betsRes.data ?? []).map((row) => {
      const creatorValue = Array.isArray(row.creator) ? row.creator[0] : row.creator;
      const takerValue = Array.isArray(row.taker) ? row.taker[0] : row.taker;
      return { ...row, creator: creatorValue, taker: takerValue } as BetRow;
    });
    setBets(normalizedBets);
    const normalizedComments = (commentsRes.data ?? []).map((row) => {
      const profileValue = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return { ...row, profiles: profileValue } as CommentRow;
    });
    setComments(normalizedComments);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (betType === "spread") {
      setSpreadTeam(teamA);
      return;
    }
    setSpreadTeam("");
  }, [betType, teamA]);

  const openBets = bets.filter((bet) => bet.status === "open");
  const myBets = bets.filter((bet) => (bet.creator_id === user?.id || bet.taker_id === user?.id) && Boolean(bet.taker_id));
  const isTakenForSettlement = (bet: BetRow) =>
    Boolean(bet.taker_id) && bet.status !== "closed" && bet.status !== "cancelled";
  const isAdminManageableBet = (bet: BetRow) =>
    (Boolean(bet.taker_id) || bet.status === "closed") && bet.status !== "cancelled";

  const resetForm = () => {
    setTeamA("");
    setTeamB("");
    setBetType("moneyline");
    setSpreadTeam("");
    setSpreadValue("");
    setStake("");
    setDescription("");
    setEditingBetId(null);
  };

  const loadBetIntoForm = (bet: BetRow) => {
    setEditingBetId(bet.id);
    setTeamA(String(bet.team_a_id));
    setTeamB(String(bet.team_b_id));
    setBetType(bet.bet_type);
    setSpreadTeam(bet.spread_team_id ? String(bet.spread_team_id) : "");
    setSpreadValue(bet.spread_value === null ? "" : Number(bet.spread_value).toFixed(1));
    setStake(String(bet.stake_amount));
    setDescription(bet.description ?? "");
    setShowIntro(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validate = () => {
    if (!teamA || !teamB) return "Pick two teams.";
    if (teamA === teamB) return "Teams must be different.";
    const stakeValue = Number(stake);
    if (!stake || Number.isNaN(stakeValue)) return "Stake amount is required.";
    if (stakeValue < STAKE_MIN) return `Stake must be at least $${STAKE_MIN}.`;
    if (stakeValue > STAKE_MAX) return `Stake must be under $${STAKE_MAX}.`;
    if (betType === "spread") {
      if (!spreadTeam) return "Pick which team has the spread.";
      if (!spreadValue) return "Spread value is required.";
      const spread = Number(spreadValue);
      if (Number.isNaN(spread)) return "Spread value is invalid.";
      if (spread < SPREAD_MIN || spread > SPREAD_MAX) {
        return `Spread must be between ${SPREAD_MIN} and ${SPREAD_MAX}.`;
      }
    }
    return null;
  };

  async function createBet() {
    if (!user) return;
    const validation = validate();
    if (validation) {
      setNotice(validation);
      return;
    }
    setSubmitting(true);
    setNotice(null);

    const payload: Partial<SideBet> = {
      team_a_id: Number(teamA),
      team_b_id: Number(teamB),
      bet_type: betType,
      stake_amount: Number(stake),
      description: description.trim() ? description.trim() : null,
      spread_team_id: betType === "spread" ? Number(spreadTeam) : null,
      spread_value: betType === "spread" ? Number(spreadValue) : null,
      status: "open"
    };

    const res = editingBetId
      ? profile?.is_admin
        ? await supabase.from("side_bets").update(payload).eq("id", editingBetId)
        : await supabase.from("side_bets").update(payload).eq("id", editingBetId).eq("creator_id", user.id).eq("status", "open")
      : await supabase.from("side_bets").insert({ ...payload, creator_id: user.id }).select();
    if (res.error) {
      setNotice(res.error.message);
      setSubmitting(false);
      return;
    }

    resetForm();
    setNotice(editingBetId ? "Side bet updated." : "Side bet posted.");
    await load();
    setSubmitting(false);
  }

  async function takeBet(betId: number) {
    if (!user) return;
    setNotice(null);
    const res = await supabase
      .from("side_bets")
      .update({ status: "taken", taker_id: user.id })
      .eq("id", betId)
      .eq("status", "open");
    if (res.error) {
      setNotice(res.error.message);
      return;
    }
    setNotice("Bet taken. Confirm details with your opponent.");
    await load();
  }

  async function cancelBet(betId: number) {
    setNotice(null);
    const res = await supabase.from("side_bets").update({ status: "cancelled" }).eq("id", betId);
    if (res.error) {
      setNotice(res.error.message);
      return;
    }
    setNotice("Bet cancelled.");
    await load();
  }

  async function settleBet(bet: BetRow, winnerId: string) {
    setNotice(null);
    const res = await supabase
      .from("side_bets")
      .update({ status: "closed", winner_id: winnerId, settled_at: new Date().toISOString() })
      .eq("id", bet.id);
    if (res.error) {
      setNotice(res.error.message);
      return;
    }
    setNotice("Bet settled.");
    await load();
  }

  async function submitWinnerSelection(bet: BetRow, winnerId: string) {
    if (!user) return;
    setNotice(null);

    const updates: Record<string, string | null> = {};
    if (user.id === bet.creator_id) {
      updates.creator_selected_winner_id = winnerId;
    } else if (user.id === bet.taker_id) {
      updates.taker_selected_winner_id = winnerId;
    } else {
      return;
    }

    const nextCreatorWinner =
      user.id === bet.creator_id ? winnerId : bet.creator_selected_winner_id;
    const nextTakerWinner =
      user.id === bet.taker_id ? winnerId : bet.taker_selected_winner_id;

    if (nextCreatorWinner && nextCreatorWinner === nextTakerWinner) {
      updates.status = "closed";
      updates.winner_id = nextCreatorWinner;
      updates.settled_at = new Date().toISOString();
    } else {
      updates.status = "taken";
      updates.winner_id = null;
      updates.settled_at = null;
    }

    const res = await supabase.from("side_bets").update(updates).eq("id", bet.id);
    if (res.error) {
      setNotice(res.error.message);
      return;
    }

    setNotice(
      updates.status === "closed"
        ? "Winner confirmed by both users. Bet closed."
        : "Your winner selection was saved. Waiting for the other user."
    );
    await load();
  }

  async function adminSettleBet(bet: BetRow, winnerId: string) {
    await settleBet(bet, winnerId);
  }

  async function adminReopenBet(bet: BetRow) {
    if (!profile?.is_admin) return;
    setNotice(null);
    const res = await supabase
      .from("side_bets")
      .update({
        status: "open",
        taker_id: null,
        creator_selected_winner_id: null,
        taker_selected_winner_id: null,
        winner_id: null,
        settled_at: null
      })
      .eq("id", bet.id);
    if (res.error) {
      setNotice(res.error.message);
      return;
    }

    loadBetIntoForm({
      ...bet,
      status: "open",
      taker_id: null,
      creator_selected_winner_id: null,
      taker_selected_winner_id: null,
      winner_id: null,
      settled_at: null
    });
    setNotice("Bet reopened for editing.");
    await load();
  }

  async function submitComment(betId: number) {
    if (!user) return;
    const message = (commentDrafts[betId] || "").trim();
    if (!message) return;
    setCommentSubmitting(betId);
    setNotice(null);
    const res = await supabase.from("side_bet_comments").insert({
      bet_id: betId,
      user_id: user.id,
      message
    });
    if (res.error) {
      setNotice(res.error.message);
      setCommentSubmitting(null);
      return;
    }
    setCommentDrafts((prev) => ({ ...prev, [betId]: "" }));
    await load();
    setCommentSubmitting(null);
  }

  const renderBetTitle = (bet: BetRow) => {
    const teamAInfo = teamMap.get(String(bet.team_a_id));
    const teamBInfo = teamMap.get(String(bet.team_b_id));
    const flagA = teamAInfo ? flagForCode(teamAInfo.code) : null;
    const flagB = teamBInfo ? flagForCode(teamBInfo.code) : null;
    return `${flagA ? flagA + " " : ""}${teamAInfo?.name ?? "I'm Backing"} vs ${flagB ? flagB + " " : ""}${teamBInfo?.name ?? "Opponent"}`;
  };

  const renderBetLine = (bet: BetRow) => {
    if (bet.bet_type === "moneyline") return "Moneyline";
    const spreadTeamInfo = bet.spread_team_id ? teamMap.get(String(bet.spread_team_id)) : null;
    const spreadFlag = spreadTeamInfo ? flagForCode(spreadTeamInfo.code) : null;
    const spreadAmount = Number(bet.spread_value);
    const spreadLabel = Number.isNaN(spreadAmount)
      ? String(bet.spread_value ?? "")
      : spreadAmount > 0
        ? `+${spreadAmount.toFixed(1)}`
        : spreadAmount.toFixed(1);
    return `Spread: ${spreadFlag ? spreadFlag + " " : ""}${spreadTeamInfo?.name ?? "Team"} ${spreadLabel}`;
  };

  const formatStake = (value: unknown) => {
    const amount = Number(value);
    if (Number.isNaN(amount)) return "$0.00";
    return `$${amount.toFixed(2)}`;
  };

  const renderUserName = (value?: { display_name: string | null; email: string } | null) => {
    if (!value) return "Player";
    return value.display_name || value.email || "Player";
  };

  const renderWinner = (bet: BetRow) => {
    if (!bet.winner_id) return "—";
    if (bet.winner_id === bet.creator_id) return renderUserName(bet.creator);
    if (bet.winner_id === bet.taker_id) return renderUserName(bet.taker);
    return "—";
  };

  const renderSelectedWinner = (bet: BetRow, winnerId: string | null) => {
    if (!winnerId) return "Pending";
    if (winnerId === bet.creator_id) return renderUserName(bet.creator);
    if (winnerId === bet.taker_id) return renderUserName(bet.taker);
    return "Pending";
  };

  const renderComments = (betId: number) => {
    const list = comments.filter((c) => c.bet_id === betId);
    return (
      <div className="mt-3">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Comments</p>
        <div className="mt-2 space-y-2">
          {list.length === 0 ? (
            <p className="text-xs text-slate-500">No comments yet.</p>
          ) : (
            list.map((c) => (
              <div key={c.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <span className="font-semibold text-slate-200">{renderUserName(c.profiles)}:</span>{" "}
                <span className="text-slate-200">{c.message}</span>
              </div>
            ))
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-[240px] flex-1 rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm"
            placeholder="Add a comment"
            value={commentDrafts[betId] || ""}
            onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [betId]: e.target.value }))}
          />
          <button
            className="btn btn-secondary"
            type="button"
            disabled={commentSubmitting === betId}
            onClick={() => void submitComment(betId)}
          >
            {commentSubmitting === betId ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    );
  };

  if (loading) return <Loading label="Loading side bets..." />;

  return (
    <>
      <AppHeader user={user} isAdmin={Boolean(profile?.is_admin)} />

      {error ? <Notice text={error} tone="danger" /> : null}
      {notice ? (
        <div className="mb-3">
          <Notice text={notice} tone={notice.includes("error") ? "danger" : "success"} />
        </div>
      ) : null}

      {showIntro ? (
        <section className="glass mb-6 rounded-2xl p-5">
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">Side Bets</h1>
              <p className="text-sm text-slate-300">Make real money side bets with other users!</p>
            </div>
            <button
              className="justify-self-end rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs uppercase tracking-[0.14em] text-slate-200 hover:bg-white/10"
              onClick={() => setShowIntro(false)}
              type="button"
            >
              Hide
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">Post a side bet</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-200">
                I&apos;m Backing
                <select
                  className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm"
                  value={teamA}
                  onChange={(e) => setTeamA(e.target.value)}
                >
                  <option value="">Select team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {flagForCode(team.code) ? `${flagForCode(team.code)} ` : ""}{team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-200">
                Opponent
                <select
                  className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm"
                  value={teamB}
                  onChange={(e) => setTeamB(e.target.value)}
                >
                  <option value="">Select team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {flagForCode(team.code) ? `${flagForCode(team.code)} ` : ""}{team.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="text-sm text-slate-200">
                Bet Type
                <select
                  className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm"
                  value={betType}
                  onChange={(e) => setBetType(e.target.value as "moneyline" | "spread")}
                >
                  <option value="moneyline">Moneyline</option>
                  <option value="spread">Spread</option>
                </select>
              </label>
              <label className="text-sm text-slate-200">
                Stake (required)
                <input
                  className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm"
                  inputMode="decimal"
                  placeholder="$"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                />
              </label>
              <label className="text-sm text-slate-200">
                Comment (optional)
                <input
                  className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm"
                  placeholder="e.g., final score or vibe"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
            </div>

            {betType === "spread" ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-200">
                  Spread Team
                  <select
                    className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm"
                    value={spreadTeam}
                    disabled
                    onChange={(e) => setSpreadTeam(e.target.value)}
                  >
                    <option value="">Select team</option>
                    {[teamA, teamB].filter(Boolean).map((id) => {
                      const team = teamMap.get(id);
                      if (!team) return null;
                      return (
                        <option key={id} value={id}>
                          {flagForCode(team.code) ? `${flagForCode(team.code)} ` : ""}{team.name}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="text-sm text-slate-200">
                  Spread Value
                  <select
                    className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm"
                    value={spreadValue}
                    onChange={(e) => setSpreadValue(e.target.value)}
                  >
                    <option value="">Select spread</option>
                    {SPREAD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button className="btn btn-primary" type="button" onClick={createBet} disabled={submitting}>
                {submitting ? (editingBetId ? "Saving..." : "Posting...") : editingBetId ? "Save Changes" : "Post Side Bet"}
              </button>
              {editingBetId ? (
                <button className="btn btn-secondary" type="button" onClick={resetForm} disabled={submitting}>
                  Cancel Edit
                </button>
              ) : null}
              <p className="text-xs text-slate-400">Stake is required. All bets are real money.</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="glass mb-6 rounded-2xl p-5">
        <h2 className="mb-1 text-lg font-semibold">Unmatched Bets</h2>
        <p className="mb-3 text-sm text-slate-300">Posted by other users. Do you want to take the other side?</p>
        {openBets.length === 0 ? (
          <p className="text-sm text-slate-400">No open bets yet. Post one above.</p>
        ) : (
          <div className="space-y-3">
            {openBets.map((bet) => {
              const isCreator = bet.creator_id === user?.id;
              return (
                <article key={bet.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{renderBetTitle(bet)}</p>
                      <p className="text-xs text-slate-400">{renderBetLine(bet)}</p>
                      <p className="mt-1 text-xs text-slate-400">Stake: {formatStake(bet.stake_amount)}</p>
                      {bet.description ? <p className="mt-2 text-sm text-slate-200">{bet.description}</p> : null}
                      <p className="mt-2 text-xs text-slate-500">Posted by {renderUserName(bet.creator)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isCreator ? (
                        <>
                          <button className="btn btn-secondary" type="button" onClick={() => loadBetIntoForm(bet)}>
                            Edit
                          </button>
                          <button className="btn btn-secondary" type="button" onClick={() => void cancelBet(bet.id)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button className="btn btn-primary" type="button" onClick={() => void takeBet(bet.id)}>
                          Take Bet
                        </button>
                      )}
                    </div>
                  </div>
                  {renderComments(bet.id)}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="mb-3 text-lg font-semibold">Your Matched Bets</h2>
        {myBets.length === 0 ? (
          <p className="text-sm text-slate-400">You do not have any matched bets yet.</p>
        ) : (
          <div className="space-y-3">
            {myBets.map((bet) => {
              const isCreator = bet.creator_id === user?.id;
              const isTaker = bet.taker_id === user?.id;
              const canSettle = (isCreator || isTaker) && isTakenForSettlement(bet);
              return (
                <article key={bet.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{renderBetTitle(bet)}</p>
                      <p className="text-xs text-slate-400">{renderBetLine(bet)}</p>
                      <p className="mt-1 text-xs text-slate-400">Stake: {formatStake(bet.stake_amount)}</p>
                      <p className="mt-1 text-xs text-slate-500">Status: {bet.status}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {renderUserName(bet.creator)} confirmed winner as {renderSelectedWinner(bet, bet.creator_selected_winner_id)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {renderUserName(bet.taker)} confirmed winner as {renderSelectedWinner(bet, bet.taker_selected_winner_id)}
                      </p>
                      {bet.status === "closed" ? (
                        <p className="mt-2 inline-flex items-center rounded-full border border-emerald-300/35 bg-emerald-400/12 px-3 py-1 text-xs font-semibold tracking-[0.06em] text-emerald-100">
                          Confirmed Winner: {renderWinner(bet)}
                        </p>
                      ) : null}
                      {bet.description ? <p className="mt-2 text-sm text-slate-200">{bet.description}</p> : null}
                    </div>
                    {canSettle ? (
                      <div className="flex flex-col gap-2 text-xs text-slate-300">
                        <span className="uppercase tracking-[0.16em] text-slate-400">Pick winner</span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => void submitWinnerSelection(bet, bet.creator_id)}
                          >
                            Winner: {renderUserName(bet.creator)}
                          </button>
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => bet.taker_id && void submitWinnerSelection(bet, bet.taker_id)}
                          >
                            Winner: {renderUserName(bet.taker)}
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500">The bet closes automatically when both users pick the same winner.</p>
                      </div>
                    ) : isCreator && bet.status === "open" ? (
                      <div className="flex flex-wrap gap-2">
                        <button className="btn btn-secondary" type="button" onClick={() => loadBetIntoForm(bet)}>
                          Edit
                        </button>
                        <button className="btn btn-secondary" type="button" onClick={() => void cancelBet(bet.id)}>
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {renderComments(bet.id)}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {profile?.is_admin ? (
        <section className="glass mt-6 rounded-2xl p-5">
          <h2 className="mb-3 text-lg font-semibold">Admin Bet Overrides</h2>
          <p className="text-sm text-slate-300">Reopen, edit, or settle any matched bet in case of disputes.</p>
          <div className="mt-4 space-y-3">
            {bets
              .filter((bet) => isAdminManageableBet(bet))
              .map((bet) => {
                const opponentName = renderUserName(bet.taker);
                return (
                  <article key={bet.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{renderBetTitle(bet)}</p>
                        <p className="text-xs text-slate-400">{renderBetLine(bet)}</p>
                        <p className="mt-1 text-xs text-slate-400">Stake: {formatStake(bet.stake_amount)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Posted by {renderUserName(bet.creator)} vs {opponentName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Status: {bet.status}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => void adminReopenBet(bet)}
                        >
                          Reopen & Edit
                        </button>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => void adminSettleBet(bet, bet.creator_id)}
                        >
                          Winner: {renderUserName(bet.creator)}
                        </button>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => bet.taker_id && void adminSettleBet(bet, bet.taker_id)}
                        >
                          Winner: {opponentName}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            {bets.filter((bet) => isAdminManageableBet(bet)).length === 0 ? (
              <p className="text-sm text-slate-400">No matched bets to manage.</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
