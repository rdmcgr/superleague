export type ChapterStatus = "draft" | "open" | "locked" | "graded";

export type Team = {
  id: number;
  name: string;
  code: string;
};

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  shit_talk: string | null;
  shit_talk_updated_at: string | null;
  invite_code_used: string | null;
  invite_approved_at: string | null;
  is_admin: boolean;
};

export type Chapter = {
  id: number;
  slug: string;
  name: string;
  status: ChapterStatus;
  opens_at: string | null;
  locks_at: string | null;
};

export type Question = {
  id: number;
  chapter_id: number;
  prompt: string;
  order_index: number;
  points: number;
  short_label: string | null;
  is_active: boolean;
};

export type Pick = {
  id: number;
  user_id: string;
  question_id: number;
  chapter_id: number;
  team_id: number;
  created_at: string;
  updated_at: string;
};

export type ResultTeam = {
  question_id: number;
  team_id: number;
  points: number;
};

export type StandingRow = {
  user_id: string;
  display_name: string;
  total_points: number;
  correct_picks: number;
  total_picks: number;
};

export type SideBetStatus = "open" | "taken" | "closed" | "cancelled";

export type SideBetType = "moneyline" | "spread";

export type SideBet = {
  id: number;
  creator_id: string;
  taker_id: string | null;
  team_a_id: number;
  team_b_id: number;
  bet_type: SideBetType;
  spread_team_id: number | null;
  spread_value: number | null;
  stake_amount: number;
  description: string | null;
  status: SideBetStatus;
  winner_id: string | null;
  settled_at: string | null;
  created_at: string;
};

export type SideBetComment = {
  id: number;
  bet_id: number;
  user_id: string;
  message: string;
  created_at: string;
};
