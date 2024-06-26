/**
 * Shared utils functions.
 */

import {
  ChatContext,
  ChatKind,
  GroupChatStageConfig,
  ITEM_NAMES,
  InfoStageConfig,
  ItemName,
  MediatorConfig,
  MediatorKind,
  ProfileStageConfig,
  QuestionConfig,
  RatingQuestionConfig,
  RevealVotedStageConfig,
  StageConfig,
  StageKind,
  SurveyQuestionKind,
  SurveyStageConfig,
  TermsOfServiceStageConfig,
  VoteForLeaderStageConfig,
  choices,
  pairs,
  seed
} from '@llm-mediation-experiments/utils';
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { v4 as uuidv4 } from "uuid";
import { LAS_FINAL_SURVEY, LAS_FINAL_SURVEY_DESCRIPTION, LAS_GROUP_CHAT_DESCRIPTION, LAS_INITIAL_TASK_DESCRIPTION, LAS_INTRO_DESCRIPTION, LAS_INTRO_INFO_LINES, LAS_LEADER_ELECTION_DESCRIPTION, LAS_LEADER_REVEAL_DESCRIPTION, LAS_LEADER_TASK_DESCRIPTION, LAS_REDO_TASK_DESCRIPTION } from './lost_at_sea_constants';
import { GEMINI_DEFAULT_MODEL, PROMPT_INSTRUCTIONS_CHAT_MEDIATOR } from "./prompts";
import { Snapshot } from "./types";

/** Generate unique id. */
export function generateId(): string {
  return uuidv4();
}

/** Create info stage. */
export function createInfoStage(
  name = "Info", description = "Info description", content = ["Placeholder info"]
): InfoStageConfig {
  const infoLines = content;
  return { kind: StageKind.Info, name, description, infoLines };
}

/** Create TOS stage. */
export function createTOSStage(
  name = "Terms of service",
  description = "Acknowledge the terms of service to proceed.",
  content = "- Placeholder term 1\n- Placeholder term 2\n- Placeholder term 3",
): TermsOfServiceStageConfig {
  const tosLines = [content];
  return { kind: StageKind.TermsOfService, name, description, tosLines };
}

/** Create survey stage. */
export function createSurveyStage(
  name = "Survey",
  description = "Survey description",
  questions: QuestionConfig[] = []
): SurveyStageConfig {
  return { kind: StageKind.TakeSurvey, name, description, questions };
}

/** Create profile stage. */
export function createProfileStage(name = "Set profile"): ProfileStageConfig {
  // Bug: Experiment can't be created with a profile description.
  return { kind: StageKind.SetProfile, name};
}

/** Create chat (with ranking discussion) stage. */
export function createChatStage(
  name = "Group discussion",
  description = "Group discussion description",
  ratingsToDiscuss: { item1: ItemName; item2: ItemName }[] = []
): GroupChatStageConfig {
  if (ratingsToDiscuss.length === 0) {
    return {
      name,
      description,
      kind: StageKind.GroupChat,
      chatId: generateId(),
      chatConfig: {
        kind: ChatKind.SimpleChat,
      },
      mediators: [],
    };
  }

  return {
    name,
    description,
    kind: StageKind.GroupChat,
    chatId: generateId(),
    chatConfig: {
      kind: ChatKind.ChatAboutItems,
      ratingsToDiscuss
    },
    mediators: [],
  };
}

/** Create default LLM mediator. */
export function createMediator(
  name = "LLM Mediator",
  avatar = "🤖",
): MediatorConfig {
  return {
    id: generateId(),
    name,
    avatar,
    model: GEMINI_DEFAULT_MODEL,
    prompt: PROMPT_INSTRUCTIONS_CHAT_MEDIATOR,
    chatContext: ChatContext.All,
    kind: MediatorKind.Automatic,
    filterMediatorMessages: true,
  };
}

/** Create leader vote (election) stage. */
export function createVoteForLeaderStage(
  name = "Leader election",
  description = "Vote for the leader here.",
): VoteForLeaderStageConfig {
  return { kind: StageKind.VoteForLeader, name, description };
}

/**
 * Create leader reveal stage.
 * NOTE: This currently does not assign the VoteForLeader stage to
 * the RevealVoted stage; rather, this is assigned in `convertExperimentStages`
 * with the assumption that there is only one VoteForLeader stage.
 *
 * TODO: Make this an implicit "Reveal" stage for all stages, not just leader
 * election.
 */
export function createRevealVotedStage(
  name = "Reveal",
  description = "This is the outcome of the vote.",
): RevealVotedStageConfig {
  return { kind: StageKind.RevealVoted, name, description, pendingVoteStageName: "" };
}

/**
 * Create Lost at Sea game module stages.
 *
 * This includes:
 *   2 individual tasks with the same randomly-generated item pairs
 *   1 chat discussion based around those item pairs
 *   1 leader task with different randomly-generated item pairs
 */

export function createLostAtSeaModuleStages(numPairs = 5): StageConfig[] {
  const stages: StageConfig[] = [];

  // Add introduction
  stages.push(createInfoStage("Welcome to the experiment", LAS_INTRO_DESCRIPTION, LAS_INTRO_INFO_LINES));
  
  // Shuffle the items.
  seed(6272023);
  const middleIndex = Math.ceil(ITEM_NAMES.length / 2);

  // Take random items from the first half for the individual tasks.
  const INDIVIDUAL_ITEM_NAMES = ITEM_NAMES.slice(0, middleIndex);
  const INDIVIDUAL_ITEM_PAIRS = choices(pairs(INDIVIDUAL_ITEM_NAMES), numPairs);

  // Take random items from the second half for the leader tasks.
  const LEADER_ITEM_NAMES = ITEM_NAMES.slice(middleIndex);
  const LEADER_ITEM_PAIRS = choices(pairs(LEADER_ITEM_NAMES), numPairs);

  // Add individual surveys
  const INDIVIDUAL_QUESTIONS: RatingQuestionConfig[] = INDIVIDUAL_ITEM_PAIRS.map(
    (pair, index) => getRatingQuestionFromPair(pair, index)
  );

  stages.push(createSurveyStage("Initial survival task", LAS_INITIAL_TASK_DESCRIPTION, INDIVIDUAL_QUESTIONS));

  // Add chat with individual item pairs as discussion
  stages.push(
    createChatStage(
      "Group discussion",
      LAS_GROUP_CHAT_DESCRIPTION,
      INDIVIDUAL_ITEM_PAIRS.map(([i1, i2]) => ({ item1: i1, item2: i2 }))
    )
  );

  stages.push(createSurveyStage("Updated individual task", LAS_REDO_TASK_DESCRIPTION, INDIVIDUAL_QUESTIONS));
  stages.push(createVoteForLeaderStage("Representative election", LAS_LEADER_ELECTION_DESCRIPTION));

  // Add leader task
  const LEADER_QUESTIONS: RatingQuestionConfig[] = LEADER_ITEM_PAIRS.map(
    (pair, index) => getRatingQuestionFromPair(pair, index)
  );

  stages.push(createSurveyStage("Representative task", LAS_LEADER_TASK_DESCRIPTION, LEADER_QUESTIONS));

  stages.push(createRevealVotedStage("Representative reveal", LAS_LEADER_REVEAL_DESCRIPTION))

  // Final survey
  stages.push(createSurveyStage("Final survey", LAS_FINAL_SURVEY_DESCRIPTION, LAS_FINAL_SURVEY));

  return stages;
}

/**
 * Uses item pair to create survey RatingQuestion.
 */
export function getRatingQuestionFromPair(
  pair: [string, string],
  id: number,
  questionText = "Choose the item that would be more helpful to your survival",
): RatingQuestionConfig {

  const [one, two] = pair;
  const item1: ItemName = (one as ItemName);
  const item2: ItemName = (two as ItemName);

  return {
    id,
    kind: SurveyQuestionKind.Rating,
    questionText,
    item1,
    item2,
  };
}


/**
 * Check if stage is part of the LostAtSea module.
 * TODO: Use more robust logic, e.g., add a moduleType field to track this.
 */
export function isLostAtSeaModuleStage(stage: StageConfig) {
  // This relies on the fact that we only allow RatingQuestions and Chat
  // stages for Lost at Sea module stages.
  return (stage.kind === StageKind.TakeSurvey &&
    stage.questions.find(q => q.kind === SurveyQuestionKind.Rating))
    || (stage.kind === StageKind.GroupChat && stage.chatConfig.kind === ChatKind.ChatAboutItems);
}

/**
 * Get ratingsToDiscuss from chatConfig (empty if not ChatAboutItems kind).
 */
export function getChatRatingsToDiscuss(stage: GroupChatStageConfig) {
  if (!stage) {
    return [];
  }
  return stage.chatConfig.kind === ChatKind.ChatAboutItems ?
    stage.chatConfig.ratingsToDiscuss : [];
}

/**
 * Find index of specific stage kind.
 * NOTE: Currently used to assign VoteForLeader stage to Reveal stage
 * (as stage names are not guaranteed to be unique, and we currenly
 * only allow one VoteForLeader stage)
 */
export function findStageKind(stages: StageConfig[], kind: StageKind) {
  return stages.findIndex(stage => stage.kind === kind);
}

/** Use micromark to convert Git-flavored markdown to HTML. */
export function convertMarkdownToHTML(markdown: string, sanitize = true) {
  const html = micromark(markdown, {
    allowDangerousHtml: !sanitize,
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  });

  return html;
}

/**
 *  Adjust experiment stages to Firebase format (e.g., HTML instead of .md)
 *  and add numbering to stages.
 */
export function convertExperimentStages(stages: StageConfig[]) {
  const addIndexToStageName = (name: string, index: number) => {
    if (index + 1 < 10) {
      return `0${index + 1}. ${name}`;
    }
    return `${index + 1}. ${name}`;
  };

  return stages.map((stage, index) => {
    stage.name = addIndexToStageName(stage.name, index);

    if (stage.kind === StageKind.TermsOfService) {
      stage.tosLines = stage.tosLines.map(
        info => convertMarkdownToHTML(info)
      );
      return stage;
    }
    if (stage.kind === StageKind.RevealVoted) {
      // NOTE: This assumes there is only one VoteForLeader stage
      // and that it is ordered before the reveal stage.
      const voteIndex = findStageKind(stages, StageKind.VoteForLeader);
      stage.pendingVoteStageName = stages[voteIndex]?.name;
      return stage;
    }
    return stage;
  })
}

/**
 * Adjust template stages to experiment stage format
 * (e.g., strip stage numbers)
 */
export function convertTemplateStages(stages: StageConfig[]) {
  const stripNumbersFromTitle = (name: string) => {
    const titleParts = name.split('. ');
    if (titleParts.length > 1) {
      return `${titleParts[1]}`;
    }
    return `Untitled stage`;
  };

  return stages.map((stage) => {
    stage.name = stripNumbersFromTitle(stage.name);
    return stage;
  });
}

/**
 * Collect the data of multiple documents into an array,
 * including the document Firestore ID within the field with the given key.
 */
export function collectSnapshotWithId<T>(snapshot: Snapshot, idKey: keyof T) {
  return snapshot.docs.map((doc) => ({ [idKey]: doc.id, ...doc.data() }) as T);
}

/** Helper to cleanup experiment data from redundant stage names */
export function excludeName<T extends { name: string }>(obj: T) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { name, ...rest } = obj;
  return rest;
}
