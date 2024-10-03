import {
  CohortConfig
} from './cohort';
import {
  Experiment
} from './experiment';
import {
  ParticipantProfileExtended
} from './participant';
import {
  ChatMessage
} from './stages/chat_stage';
import {
  StageConfig,
  StageParticipantAnswer,
  StagePublicData
} from './stages/stage';

/** Experiment data download types and functions. */

// ************************************************************************* //
// TYPES                                                                     //
// ************************************************************************* //

export interface ExperimentDownload {
  // Experiment config
  experiment: Experiment;
  // Maps from stage ID to stage config
  stageMap: Record<string, StageConfig>;
  // Maps from participant public ID to participant download
  participantMap: Record<string, ParticipantDownload>;
  // Maps from cohort ID to cohort download
  cohortMap: Record<string, CohortDownload>;
  // TODO: add roleMap once roles are added
}

export interface ParticipantDownload {
  profile: ParticipantProfileExtended;
  // Maps from stage ID to participant's stage answer
  answerMap: Record<string, StageParticipantAnswer>;
}

export interface CohortDownload {
  cohort: CohortConfig;
  // Maps from stage ID to stage public data
  dataMap: Record<string, StagePublicData>;
  // Maps from stage ID to ordered list of chat messages
  chatMap: Record<string, ChatMessage>;
}