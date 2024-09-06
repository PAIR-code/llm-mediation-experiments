import { Type, type Static } from '@sinclair/typebox';
import {
  MetadataConfigSchema
} from './shared.validation';
import {
  CohortParticipantConfigSchema
} from './experiment.validation';
import { StageConfigData } from './stages/stage.validation';

/** Shorthand for strict TypeBox object validation */
const strict = { additionalProperties: false } as const;

// ************************************************************************* //
// writeCohort endpoint                                                      //
// ************************************************************************* //

export const CohortCreationData = Type.Object(
  {
    experimentId: Type.String({ minLength: 1 }),
    cohortConfig: Type.Object(
      {
        id: Type.String(),
        metadata: MetadataConfigSchema,
        participantConfig: CohortParticipantConfigSchema,
      },
      strict,
    ),
  },
  strict,
);

export type CohortCreationData = Static<typeof CohortCreationData>;