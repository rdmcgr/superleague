import { flagForCode } from "@/lib/flags";
import type { Chapter, Question, Team } from "@/lib/types";

export type StoryCardSection = {
  title: string;
  items: string[];
};

export type StoryCardPick = {
  question_id: number;
  team_id: number;
};

export function buildStoryCardSections(
  chapters: Chapter[],
  questions: Question[],
  picks: StoryCardPick[],
  teams: Team[]
) {
  const groupStage = chapters.find((chapter) => chapter.slug === "group-stage");
  if (!groupStage || (groupStage.status !== "locked" && groupStage.status !== "graded")) return [] as StoryCardSection[];

  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const questionByOrder = (orderIndex: number) =>
    questions.find((question) => question.chapter_id === groupStage.id && question.order_index === orderIndex);
  const teamLabelForQuestion = (questionId: number | undefined) => {
    if (!questionId) return null;
    const pick = picks.find((entry) => entry.question_id === questionId);
    if (!pick) return null;
    const team = teamMap.get(pick.team_id);
    if (!team) return null;
    const flag = flagForCode(team.code);
    return `${flag ? `${flag} ` : ""}${team.name}`;
  };

  const sections: StoryCardSection[] = [];
  const tourneyWinner = teamLabelForQuestion(questionByOrder(1)?.id);
  if (tourneyWinner) {
    sections.push({
      title: "Champion",
      items: [tourneyWinner]
    });
  }

  const groupWinners = [teamLabelForQuestion(questionByOrder(2)?.id), teamLabelForQuestion(questionByOrder(3)?.id)].filter(
    (value): value is string => Boolean(value)
  );
  if (groupWinners.length) {
    sections.push({
      title: "Group Winners",
      items: groupWinners
    });
  }

  const qualifiers = [teamLabelForQuestion(questionByOrder(4)?.id), teamLabelForQuestion(questionByOrder(5)?.id)].filter(
    (value): value is string => Boolean(value)
  );
  if (qualifiers.length) {
    sections.push({
      title: "Additional Knockout Stage Qualifiers",
      items: qualifiers
    });
  }

  return sections;
}
