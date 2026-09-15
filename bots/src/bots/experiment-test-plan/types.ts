/**
 * Types and schema for the Experiment Test Plan Assistant.
 */

export interface ExperimentTestPlanDetails {
  experimentTemplate?: string;
  stagesSequence?: string;
  humanParticipants?: string;
  agentMediator?: string;
  agentParticipants?: string;
  participantActions?: string;
  successCriteria?: string;
}

export interface SuggestedTentativePlan {
  experimentTemplate: string;
  stagesSequence: string;
  humanParticipants: string;
  agentMediator: string;
  agentParticipants: string;
  participantActions: string;
  successCriteria: string;
}

export interface ExperimentTestPlanEvaluation {
  isRuntimeBehaviorChange: boolean;
  classificationRationale: string;
  hasManualTestPlan: boolean;
  manualPlanDetails?: ExperimentTestPlanDetails;
  missingElements: string[];
  canDeducePlan?: boolean;
  guidanceNeededReason?: string;
  suggestedTentativePlan?: SuggestedTentativePlan;
}
