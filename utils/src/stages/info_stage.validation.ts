import {Type, type Static} from '@sinclair/typebox';
import {BaseStageConfig, StageKind} from './stage';
import {
  BaseStageConfigSchema,
  type StageValidationResult,
} from './stage.schemas';
import {InfoStageConfig} from './info_stage';

/** Shorthand for strict TypeBox object validation */
const strict = {additionalProperties: false} as const;

// ************************************************************************* //
// writeExperiment, updateStageConfig endpoints                              //
// ************************************************************************* //

/** InfoStageConfig input validation. */
export const InfoStageConfigData = Type.Composite(
  [
    BaseStageConfigSchema,
    Type.Object(
      {
        kind: Type.Literal(StageKind.INFO),
        infoLines: Type.Array(Type.String()),
        // Optional YouTube video ID to display
        youtubeVideoId: Type.Optional(Type.Union([Type.Null(), Type.String()])),
        timeLimitInMinutes: Type.Optional(
          Type.Union([Type.Integer({minimum: 1}), Type.Null()]),
        ),
        timeMinimumInMinutes: Type.Optional(
          Type.Union([Type.Integer({minimum: 1}), Type.Null()]),
        ),
      },
      strict,
    ),
  ],
  {$id: 'InfoStageConfig', ...strict},
);

// ************************************************************************* //
// FUNCTIONS                                                                 //
// ************************************************************************* //

export function validateInfoStageConfig(
  stage: BaseStageConfig,
): StageValidationResult {
  const {timeMinimumInMinutes: min, timeLimitInMinutes: max} =
    stage as InfoStageConfig;

  if (min != null && max != null && min > max) {
    return {
      valid: false,
      error: `timeMinimumInMinutes (${min}) cannot exceed timeLimitInMinutes (${max})`,
    };
  }

  return {valid: true};
}
