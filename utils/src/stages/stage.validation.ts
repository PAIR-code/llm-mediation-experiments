import {Type, type TSchema} from '@sinclair/typebox';
import {BaseStageConfig, StageKind} from './stage';
import {type StageValidationResult} from './stage.schemas';
import {
  AssetAllocationStageConfigData,
  MultiAssetAllocationStageConfigData,
} from './asset_allocation_stage.validation';
import {
  ChatStageConfigData,
  validateChatStageConfig,
} from './chat_stage.validation';
import {ChipStageConfigData} from './chip_stage.validation';
import {ComprehensionStageConfigData} from './comprehension_stage.validation';
import {FlipCardStageConfigData} from './flipcard_stage.validation';
import {RankingStageConfigData} from './ranking_stage.validation';
import {
  InfoStageConfigData,
  validateInfoStageConfig,
} from './info_stage.validation';
import {PayoutStageConfigData} from './payout_stage.validation';
import {
  PrivateChatStageConfigData,
  validatePrivateChatStageConfig,
} from './private_chat_stage.validation';
import {ProfileStageConfigData} from './profile_stage.validation';
import {RevealStageConfigData} from './reveal_stage.validation';
import {RoleStageConfigData} from './role_stage.validation';
import {NegotiationProfileStageConfigData} from './negotiation_profile_stage.validation';
import {NegotiationPayoutStageConfigData} from './negotiation_payout_stage.validation';
import {SalespersonStageConfigData} from './salesperson_stage.validation';
import {StockInfoStageConfigData} from './stockinfo_stage.validation';
import {
  SurveyPerParticipantStageConfigData,
  SurveyStageConfigData,
  validateSurveyStageConfig,
  validateSurveyPerParticipantStageConfig,
} from './survey_stage.validation';
import {TransferStageConfigData} from './transfer_stage.validation';
import {TOSStageConfigData} from './tos_stage.validation';

// ****************************************************************************
// Enums
// ****************************************************************************

/** Stage kind enum - uses TypeScript enum for type compatibility */
export const StageKindData = Type.Enum(StageKind, {$id: 'StageKind'});

// ************************************************************************* //
// writeExperiment, updateStageConfig endpoints                              //
// ************************************************************************* //

/** Stage config entry with schema and optional cross-field validator. */
export interface StageConfigEntry {
  schema: TSchema;
  validate?: (stage: BaseStageConfig) => StageValidationResult;
}

/** Map of stage kinds to their schema and optional validator */
export const CONFIG_DATA: Record<string, StageConfigEntry> = {
  assetAllocation: {schema: AssetAllocationStageConfigData},
  multiAssetAllocation: {schema: MultiAssetAllocationStageConfigData},
  chat: {schema: ChatStageConfigData, validate: validateChatStageConfig},
  chip: {schema: ChipStageConfigData},
  comprehension: {schema: ComprehensionStageConfigData},
  flipcard: {schema: FlipCardStageConfigData},
  info: {schema: InfoStageConfigData, validate: validateInfoStageConfig},
  payout: {schema: PayoutStageConfigData},
  privateChat: {
    schema: PrivateChatStageConfigData,
    validate: validatePrivateChatStageConfig,
  },
  profile: {schema: ProfileStageConfigData},
  ranking: {schema: RankingStageConfigData},
  reveal: {schema: RevealStageConfigData},
  role: {schema: RoleStageConfigData},
  negotiationProfile: {schema: NegotiationProfileStageConfigData},
  negotiationPayout: {schema: NegotiationPayoutStageConfigData},
  salesperson: {schema: SalespersonStageConfigData},
  stockinfo: {schema: StockInfoStageConfigData},
  surveyPerParticipant: {
    schema: SurveyPerParticipantStageConfigData,
    validate: validateSurveyPerParticipantStageConfig,
  },
  survey: {
    schema: SurveyStageConfigData,
    validate: validateSurveyStageConfig,
  },
  tos: {schema: TOSStageConfigData},
  transfer: {schema: TransferStageConfigData},
};

/** StageConfig input validation (union of all stage types) */
export const StageConfigData = Type.Union(
  Object.values(CONFIG_DATA).map((entry) => entry.schema),
);
