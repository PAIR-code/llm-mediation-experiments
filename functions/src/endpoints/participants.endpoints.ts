/** Endpoints for participanting in experiments */

import {
  QuestionAnswer,
  StageAnswerData,
  StageKind,
  SurveyStageConfig,
  lookupTable,
} from '@llm-mediation-experiments/utils';
import { Value } from '@sinclair/typebox/value';
import * as functions from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';
import { app } from '../app';

/** Generic endpoint for stage answering. */
export const updateStage = onCall(async (request) => {
  const { data } = request;

  if (Value.Check(StageAnswerData, data)) {
    const { experimentId, participantId, stageId, stage } = data;

    const answerDoc = app
      .firestore()
      .doc(`experiments/${experimentId}/participants/${participantId}/stages/${stageId}`);

    // Validation & merging answers
    switch (stage.kind) {
      case StageKind.VoteForLeader:
        if (participantId in stage.rankings)
          throw new functions.https.HttpsError('invalid-argument', 'Invalid answers');
        await answerDoc.set({ kind: StageKind.VoteForLeader, rankings: stage.rankings }, { merge: true });
        break;

      case StageKind.TakeSurvey:
        await validateSurveyAnswers(experimentId, stageId, stage.answers);

        // Prepare data to merge individual answers into the firestore document
        const data = {
          kind: StageKind.TakeSurvey,
          answers: stage.answers,
        };
        await answerDoc.set(data, { merge: true });
        break;

      case StageKind.LostAtSeaSurvey:
        // Prepare data to merge individual answers into the firestore document
        const lostAtSeaData = {
          kind: StageKind.LostAtSeaSurvey,
          answers: stage.answers,
        };
        await answerDoc.set(lostAtSeaData, { merge: true });
        break;

      case StageKind.WTLSurvey:
        const wtlData = {
          kind: StageKind.WTLSurvey,
          score: stage.score,
        };
        await answerDoc.set(wtlData, { merge: true });
        break;
      case StageKind.GroupChat:
        const chatData = {
          kind: StageKind.GroupChat,
          readyToEndChat: stage.readyToEndChat,
        };
        await answerDoc.set(chatData, { merge: true });
        break;
    }

    return { data: 'success' };
  }

  throw new functions.https.HttpsError('invalid-argument', 'Invalid data');
});

/** Helper function to validate a survey stage's answers against its related config */
const validateSurveyAnswers = async (
  experimentId: string,
  stageId: string,
  answers: Record<number, QuestionAnswer>,
) => {
  const configDoc = app.firestore().doc(`experiments/${experimentId}/stages/${stageId}`);
  const data = (await configDoc.get()).data() as SurveyStageConfig | undefined;

  if (!data) throw new functions.https.HttpsError('invalid-argument', 'Invalid answers');

  // Question configs are stored in an array. Make a "id" lookup table for easier access
  const questions = lookupTable(data.questions, 'id');

  for (const answer of Object.values(answers)) {
    const config = questions[answer.id];
    if (!config || config.kind !== answer.kind)
      throw new functions.https.HttpsError('invalid-argument', 'Invalid answers');
  }
};
