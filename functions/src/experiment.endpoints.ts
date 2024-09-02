import { Value } from '@sinclair/typebox/value';
import {
  ExperimentCreationData,
  ExperimentDelectionData,
  createExperimentConfig
} from '@deliberation-lab/utils';

import * as functions from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';

import { app } from './app';
import { AuthGuard } from './utils/auth-guard';
import {
  checkConfigDataUnionOnPath,
  isUnionError,
  prettyPrintError,
  prettyPrintErrors,
} from './utils/validation';

/** Create/update and delete experiments and experiment templates. */

// ************************************************************************* //
// writeExperiment endpoint                                                  //
// (create or update experiment to specified Firestore collection)           //
//                                                                           //
// Input structure: { collectionName, experimentConfig, stageConfigs }       //
// Validation: utils/src/experiment.validation.ts                            //
// ************************************************************************* //

export const writeExperiment = onCall(async (request) => {
  await AuthGuard.isExperimenter(request);
  const { data } = request;

  // TODO: If experiment exists, verify that the experimenter is the creator
  // before updating.

  // Validate input
  const validInput = Value.Check(ExperimentCreationData, data);
  if (!validInput) {
    handleExperimentCreationValidationErrors(data);
  }

  // Run document creation a transaction to enture consistency
  const document = app.firestore().collection(data.collectionName).doc();
  // Run document write as transaction to ensure consistency
  await app.firestore().runTransaction(async (transaction) => {
    // Add experiment doc with current experimenter as creator
    const experimentConfig = createExperimentConfig(
      data.stageConfigs,
      data.experimentConfig
    );
    experimentConfig.metadata.creator = request.auth!.uid;

    transaction.set(document, experimentConfig);

    // Add collection of stages
    for (const stage of data.stageConfigs) {
      transaction.set(document.collection('stages').doc(stage.id), stage);
    }

    // TODO: If experiment already exists, clean up obsolete docs in
    // stages, roles collections.
  });

  return { id: document.id };
});

function handleExperimentCreationValidationErrors(data: any) {
  for (const error of Value.Errors(ExperimentCreationData, data)) {
    if (isUnionError(error)) {
      const nested = checkConfigDataUnionOnPath(data, error.path);
      prettyPrintErrors(nested);
    } else {
      prettyPrintError(error);
    }
  }

  throw new functions.https.HttpsError('invalid-argument', 'Invalid data');
}

// ************************************************************************* //
// deleteExperiment endpoint                                                 //
// (recursively remove experiment doc and subcollections)                    //
//                                                                           //
// Input structure: { collectionName, experimentId }                         //
// Validation: utils/src/experiment.validation.ts                            //
// ************************************************************************* //
export const deleteExperiment = onCall(async (request) => {
  await AuthGuard.isExperimenter(request);
  const { data } = request;

  // TODO: Verify that experimenter is the creator before enabling delete

  // Validate input
  const validInput = Value.Check(ExperimentCreationData, data);
  if (!validInput) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid data');
    return { success: false };
  }

  // Delete document
  const doc = app.firestore().doc(`${data.collectionName}/${data.experimentId}`);
  app.firestore().recursiveDelete(doc);
  return { success: true };
});