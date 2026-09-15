import {generateId} from '../shared';
import {
  BaseStageConfig,
  StageKind,
  createStageTextConfig,
  createStageProgressConfig,
} from './stage';

/** Info stage types and functions. */

// ************************************************************************* //
// TYPES                                                                     //
// ************************************************************************* //

export interface InfoStageConfig extends BaseStageConfig {
  kind: StageKind.INFO;
  infoLines: string[];
  youtubeVideoId?: string;
  timeLimitInMinutes: number | null; // Maximum duration in minutes (integer), or null if no limit.
  timeMinimumInMinutes: number | null; // Minimum time participants must stay in minutes (integer), or null if no minimum.
}

// ************************************************************************* //
// CONSTANTS                                                                 //
// ************************************************************************* //

const TUTORIAL_NAME = 'ℹ️ Platform tutorial';
const TUTORIAL_INFO_LINES = [
  'Today, you will complete a task in a series of stages.',
  'Here are some parts of the interface that you may find useful:',
  '![Interface tutorial](https://raw.githubusercontent.com/PAIR-code/deliberate-lab/refs/heads/main/frontend/assets/tutorial.png)',
  '1. 🗂️ **Stage navigation**: You can reference previous stages by navigating backwards. This may be helpful in referring back to instructions or previous answers.',
  '1. 🙋‍♀️ **Help chat**: You can contact the experimenters by clicking this button. If you ever find yourself stuck or waiting on a stage, please use this feature to notify the experimenters.',
  '1. ➡️ **Next stage**: Click this button to proceed to the next stage. Sometimes, you may need to complete certain actions (e.g., answering required questions, waiting a set amount of time) before proceeding.',
];

// ************************************************************************* //
// FUNCTIONS                                                                 //
// ************************************************************************* //

/** Create info stage. */
export function createInfoStage(
  config: Partial<InfoStageConfig> = {},
): InfoStageConfig {
  return {
    id: config.id ?? generateId(),
    kind: StageKind.INFO,
    name: config.name ?? 'Info',
    descriptions: config.descriptions ?? createStageTextConfig(),
    progress: config.progress ?? createStageProgressConfig(),
    infoLines: config.infoLines ?? [],
    youtubeVideoId: config.youtubeVideoId,
    timeLimitInMinutes: config.timeLimitInMinutes ?? null,
    timeMinimumInMinutes: config.timeMinimumInMinutes ?? null,
  };
}

export function createTutorialInfoStage(
  config: Partial<InfoStageConfig> = {},
  isTutorial: boolean = false,
): InfoStageConfig {
  return {
    id: config.id ?? generateId(),
    kind: StageKind.INFO,
    name: config.name ?? TUTORIAL_NAME,
    descriptions: config.descriptions ?? createStageTextConfig(),
    progress: config.progress ?? createStageProgressConfig(),
    infoLines: config.infoLines ?? TUTORIAL_INFO_LINES,
    youtubeVideoId: config.youtubeVideoId,
    timeLimitInMinutes: config.timeLimitInMinutes ?? null,
    timeMinimumInMinutes: config.timeMinimumInMinutes ?? null,
  };
}
