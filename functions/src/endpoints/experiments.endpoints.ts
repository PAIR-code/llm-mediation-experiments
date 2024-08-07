/** Endpoints for interactions with experiments, including
 * creating/deleting experiments and participants.
 */

import {
  ChatAnswer,
  ChatKind,
  DiscussItemsMessage,
  ExperimentCreationData,
  ExperimentDeletionData,
  GroupChatStageConfig,
  MessageKind,
  ParticipantProfile,
  ParticipantProfileExtended,
  PayoutBundle,
  PayoutBundleStrategy,
  PayoutItem,
  PayoutItemStrategy,
  StageAnswer,
  StageKind,
  SurveyQuestionKind,
  getLostAtSeaPairAnswer,
  participantPublicId,
} from '@llm-mediation-experiments/utils';
import { Value } from '@sinclair/typebox/value';
import { Timestamp } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';
import { app } from '../app';
import { AuthGuard } from '../utils/auth-guard';
import {
  checkConfigDataUnionOnPath,
  isUnionError,
  prettyPrintError,
  prettyPrintErrors,
} from '../utils/validation';

/** Generic endpoint to create either experiments or experiment templates */
export const createExperiment = onCall(async (request) => {
  await AuthGuard.isExperimenter(request);

  const { data } = request;

  if (Value.Check(ExperimentCreationData, data)) {
    // Run in a transaction to ensure consistency
    const document = app.firestore().collection(data.type).doc();

    await app.firestore().runTransaction(async (transaction) => {
      const {
        name,
        publicName,
        description,
        tags,
        group,
        numberOfParticipants,
        prolificRedirectCode,
        attentionCheckConfig,
        lobbyConfig,
        participantConfig,
        isGroup,
        numExperiments,
        isMultiPart,
        dividerStageId,
        lobbyWaitSeconds,
      } = data.metadata;

      // Create the metadata document
      const stageIds = data.stages.map((stage) => stage.id);

      transaction.set(document, {
        name,
        publicName,
        description,
        tags,
        author: { uid: request.auth?.uid, displayName: request.auth?.token?.name ?? '' },
        starred: {},
        numberOfParticipants,
        participantConfig,
        prolificRedirectCode,
        attentionCheckConfig,
        stageIds,
        ...(data.type === 'experiments'
          ? { date: Timestamp.now(), group, lobbyConfig }
          : { isGroup, numExperiments, isMultiPart, dividerStageId, lobbyWaitSeconds }
        ),
      });

      // Create the stages
      for (const stage of data.stages) {
        // If payout stage, use payout config to generate scoring config
        if (stage.kind === StageKind.Payout) {
          const getScoringQuestion = (question: RatingQuestionConfig) => {
            return {
              id: question.id,
              questionText: question.questionText,
              questionOptions: [question.item1, question.item2],
              answer: getLostAtSeaPairAnswer(question.item1, question.item2),
            };
          };

          const getScoringItem = (payoutItem: PayoutItem) => {
            // To define scoring questions, convert survey stage questions
            const surveyStage = data.stages.find((stage) => stage.id === payoutItem.surveyStageId);
            let questions = surveyStage.questions.filter(
              (question) => question.kind === SurveyQuestionKind.Rating,
            );

            // If strategy is "choose one," only use one question
            if (payoutItem.strategy === PayoutItemStrategy.ChooseOne) {
              questions = [questions[Math.floor(Math.random() * questions.length)]];
            }
            return {
              name: payoutItem.name,
              description: payoutItem.description,
              fixedCurrencyAmount: payoutItem.fixedCurrencyAmount,
              currencyAmountPerQuestion: payoutItem.currencyAmountPerQuestion,
              questions: questions.map((question) => getScoringQuestion(question)),
              surveyStageId: payoutItem.surveyStageId,
              leaderStageId: payoutItem.leaderStageId ?? '',
            };
          };

          const getScoringBundle = (payoutBundle: PayoutBundle) => {
            const payoutItems = payoutBundle.payoutItems;
            // If strategy is "choose one," only use one payout item
            const items =
              payoutBundle.strategy === PayoutBundleStrategy.AddPayoutItems
                ? payoutItems
                : [payoutItems[Math.floor(Math.random() * payoutItems.length)]];
            return {
              name: payoutBundle.name,
              description: payoutBundle.description,
              scoringItems: items.map((item) => getScoringItem(item)),
            };
          };

          stage.scoring = stage.payouts.map((payout) => getScoringBundle(payout));
        }

        // Set stage
        transaction.set(document.collection('stages').doc(stage.id), stage);
      }

      // Nothing more to do if this was a template
      if (data.type === 'templates') return;

      const currentStageId = data.stages[0].id;

      // Create all participants
      Array.from({ length: numberOfParticipants }).forEach((_, i) => {
        const participant = document.collection('participants').doc();
        const participantData: ParticipantProfile = {
          publicId: participantPublicId(i),
          currentStageId,
          pronouns: null,
          name: null,
          avatarUrl: null,
          acceptTosTimestamp: null,
          completedExperiment: null,
          transferConfig: null,
          prolificId: null,
          completionType: null,
        };

        // Create the participant document
        transaction.set(participant, participantData);
      });
    });

    return { id: document.id };
  }

  // There was an error: try to extract more information
  for (const error of Value.Errors(ExperimentCreationData, data)) {
    if (isUnionError(error)) {
      const nested = checkConfigDataUnionOnPath(data, error.path);
      prettyPrintErrors(nested);
    } else {
      prettyPrintError(error);
    }
  }

  throw new functions.https.HttpsError('invalid-argument', 'Invalid data');
});

/** Generic endpoint to recursively delete either experiments or experiment templates.
 * Recursive deletion is only supported server-side.
 */
export const deleteExperiment = onCall(async (request) => {
  await AuthGuard.isExperimenter(request);

  const { data } = request;

  if (Value.Check(ExperimentDeletionData, data)) {
    const doc = app.firestore().doc(`${data.type}/${data.id}`);
    app.firestore().recursiveDelete(doc);
    return { success: true };
  }

  throw new functions.https.HttpsError('invalid-argument', 'Invalid data');
});

export const createParticipant = onCall(async (request) => {
  const { data } = request;

  // Validate the incoming data
  if (!data.experimentId) {
    throw new functions.https.HttpsError('invalid-argument', 'Experiment ID is required');
  }

  const experimentRef = app.firestore().doc(`experiments/${data.experimentId}`);
  let newParticipantData: ParticipantProfileExtended | null = null;
  await app.firestore().runTransaction(async (transaction) => {
    const experimentDoc = await transaction.get(experimentRef);
    if (!experimentDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Experiment not found');
    }

    const experimentData = experimentDoc.data();
    if (!experimentData) {
      throw new functions.https.HttpsError('internal', 'Experiment data is missing');
    }

    const getCurrentStageId = () => {
      const firstId = experimentData.stageIds ? experimentData.stageIds[0] : null;
      const currentId = data.participantData?.currentStageId ?? firstId;

      if (!currentId) {
        throw new functions.https.HttpsError('internal', 'Experiment stages are missing');
      }

      // If transfer participant, advance past the current (lobby) stage
      if (data.lobbyExperimentId && experimentData.stageIds) {
        const currentIndex = experimentData.stageIds.findIndex((id) => id === currentId);
        return experimentData.stageIds[currentIndex + 1];
      }
      return currentId;
    };

    // Create a new participant document
    const participantRef = data.participantData?.privateId
      ? experimentRef.collection('participants').doc(data.participantData.privateId)
      : experimentRef.collection('participants').doc();

    const participantData: ParticipantProfile = {
      publicId: participantPublicId(experimentData.numberOfParticipants),
      currentStageId: getCurrentStageId(),
      pronouns: data.participantData?.pronouns ?? null,
      name: data.participantData?.name ?? null,
      avatarUrl: data.participantData?.avatarUrl ?? null,
      acceptTosTimestamp: data.participantData?.acceptTosTimestamp ?? null,
      completedExperiment: null,
      transferConfig: null,
      prolificId: data.participantData?.prolificId ?? data.prolificId ?? null,
      completionType: null,
    };

    // Increment the number of participants in the experiment metadata
    transaction.update(experimentRef, {
      numberOfParticipants: experimentData.numberOfParticipants + 1,
    });

    transaction.set(participantRef, participantData);
    // Retrieve the new participant data
    newParticipantData = {
      ...participantData,
      privateId: participantRef.id,
    } as ParticipantProfileExtended;

    // If transfer participant, copy private/public answers from lobby experiment
    if (data.lobbyExperimentId) {
      const answerStageIds = (
        await app
          .firestore()
          .collection(
            `experiments/${data.lobbyExperimentId}/participants/${participantRef.id}/stages`,
          )
          .get()
      ).docs.map((doc) => doc.id);

      for (const id of answerStageIds) {
        const doc = await app
          .firestore()
          .doc(
            `experiments/${data.lobbyExperimentId}/participants/${participantRef.id}/stages/${id}`,
          )
          .get();

        const ref = await app
          .firestore()
          .doc(`experiments/${data.experimentId}/participants/${participantRef.id}/stages/${id}`);
        transaction.set(ref, doc.data() as StageAnswer);
      }

      // TODO: Also copy over publicStageData for given publicId
    }
  });
  if (newParticipantData) {
    return { success: true, participant: newParticipantData };
  } else {
    throw new functions.https.HttpsError('internal', 'Failed to retrieve the new participant data');
  }
});

/** Function to delete a participant from an experiment */
export const deleteParticipant = onCall(async (request) => {
  const { data } = request;

  // Validate the incoming data
  if (!data.experimentId || !data.participantId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Experiment ID and Participant ID are required',
    );
  }

  const experimentRef = app.firestore().doc(`experiments/${data.experimentId}`);
  const participantRef = experimentRef.collection('participants').doc(data.participantId);

  await app.firestore().runTransaction(async (transaction) => {
    const experimentDoc = await transaction.get(experimentRef);
    const participantDoc = await transaction.get(participantRef);

    if (!experimentDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Experiment not found');
    }

    if (!participantDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Participant not found');
    }

    const experimentData = experimentDoc.data();
    if (!experimentData) {
      throw new functions.https.HttpsError('internal', 'Experiment data is missing');
    }

    // Decrement the number of participants in the experiment metadata
    transaction.update(experimentRef, {
      numberOfParticipants: experimentData.numberOfParticipants - 1,
    });

    // Delete the participant document
    transaction.delete(participantRef);
  });

  return { success: true };
});
