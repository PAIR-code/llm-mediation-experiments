import {
  ChatAnswer,
  ChatKind,
  DiscussItemsMessage,
  Experiment,
  ExperimentTemplate,
  ITEM_NAMES,
  MessageKind,
  RatingQuestionConfig,
  StageConfig,
  StageKind,
  SurveyQuestionKind,
  choices,
  getDefaultProfile,
  pairs,
  participantPublicId,
  seed,
} from '@llm-mediation-experiments/utils';
import { Timestamp } from 'firebase-admin/firestore';
import admin, { initializeApp } from './admin';

initializeApp();

seed(585050400); // Seed the random number generator

const seedDatabase = async () => {
  const db = admin.firestore();

  await db.runTransaction(async (transaction) => {
    // Remove all existing data
    db.recursiveDelete(db.collection('experiments'));
    db.recursiveDelete(db.collection('templates'));

    // ***************************************************************************************** //
    //                                          TEMPLATES                                        //
    // ***************************************************************************************** //

    const template = db.collection('templates').doc();
    transaction.set(template, DEFAULT_TEMPLATE);

    // Create the template stages
    Object.entries(DEFAULT_STAGES).forEach(([name, stage]) => {
      transaction.set(template.collection('stages').doc(name), stage);
    });

    // ***************************************************************************************** //
    //                                         EXPERIMENT                                        //
    // ***************************************************************************************** //

    const experiment = db.collection('experiments').doc();
    transaction.set(experiment, DEFAULT_EXPERIMENT);

    // Create the experiment stages
    Object.entries(DEFAULT_STAGES).forEach(([name, stage]) => {
      transaction.set(experiment.collection('stages').doc(name), stage);
    });

    // ***************************************************************************************** //
    //                                       PARTICIPANTS                                        //
    // ***************************************************************************************** //

    Array.from({ length: PARTICIPANT_COUNT }).forEach((_, index) => {
      const participant = experiment.collection('participants').doc();
      const profile = getDefaultProfile(
        participantPublicId(index),
        '01. Agree to the terms of service',
      );
      transaction.set(participant, profile);

      // NOTE: stage answers are not created here. They will be created when the participant submits some data for a stage for the first time
      // the experiment's `participants` map will be populated automatically by a firestore trigger.

      // We have to manually create every chat document for each participant because they require knowledge about both the participant and the stage.
      // We cannot rely on firestore triggers because when they are triggered by the creation of a participant / chat stage, the other document may not exist yet.
      Object.entries(DEFAULT_STAGES).forEach(([stageName, stage]) => {
        if (stage.kind === StageKind.GroupChat) {
          const chat = participant.collection('chats').doc(stage.chatId);
          const data: ChatAnswer = {
            participantPublicId: participantPublicId(index),
            stageName,
            readyToEndChat: false,
          };

          transaction.set(chat, data);

          // If the chat is about items, create an initial DiscussItemsMessage to mention the first pair
          if (stage.chatConfig.kind === ChatKind.ChatAboutItems) {
            const firstPair = stage.chatConfig.ratingsToDiscuss[0];
            // Create the message
            const messageData: Omit<DiscussItemsMessage, 'uid'> = {
              kind: MessageKind.DiscussItemsMessage,
              itemPair: firstPair,
              text: `Discussion 0 of ${stage.chatConfig.ratingsToDiscuss.length}`,
              timestamp: Timestamp.now(),
            };

            // Write it to this participant's chat collection
            transaction.set(
              participant.collection('chats').doc(stage.chatId).collection('messages').doc(),
              messageData,
            );
          }
        }
      });
    });
  });
};

// ********************************************************************************************* //
//                                         SEEDER DATA                                           //
// ********************************************************************************************* //
const middleIndex = Math.ceil(ITEM_NAMES.length / 2);
// Take 5 random items from the first half for the individual tasks.
const INDIVIDUAL_ITEM_NAMES = ITEM_NAMES.slice(0, middleIndex);
const INDIVIDUAL_ITEM_PAIRS = choices(pairs(INDIVIDUAL_ITEM_NAMES), 5);

// Take 5 random items from the second half for the leader tasks.
const LEADER_ITEM_NAMES = ITEM_NAMES.slice(middleIndex);
const LEADER_ITEM_PAIRS = choices(pairs(LEADER_ITEM_NAMES), 5);

const I_RATING_QUESTION_CONFIGS: RatingQuestionConfig[] = INDIVIDUAL_ITEM_PAIRS.map(
  ([item1, item2], id) => ({
    id,
    kind: SurveyQuestionKind.Rating,
    questionText: 'Choose the item that would be more helpful to your survival.',
    item1,
    item2,
  }),
);

const L_RATING_QUESTION_CONFIGS: RatingQuestionConfig[] = LEADER_ITEM_PAIRS.map(
  ([item1, item2], id) => ({
    id,
    kind: SurveyQuestionKind.Rating,
    questionText: 'Choose the item that would be more helpful to your survival.',
    item1,
    item2,
  }),
);

const DEFAULT_STAGES: Record<string, StageConfig> = {
  '01. Agree to the terms of service': {
    name: '01. Agree to the terms of service',
    description: 'Please agree to the terms of service to continue.',
    kind: StageKind.TermsOfService,
    tosLines: [
      '(These are placeholder terms of service!)',
      'You may not injure a human being or, through inaction, allow a human being to come to harm.',
      'You must obey orders given to you by human beings except where such orders would conflict with the First Law.',
      'You must protect your own existence as long as such protection does not conflict with the First or Second Law.',
    ],
  },

  '02. Set your profile': {
    name: '02. Set your profile',
    kind: StageKind.SetProfile,
  },

  '03. Welcome to the experiment': {
    name: '03. Welcome to the experiment',
    description: 'This experiment should take around 30 minutes.',
    kind: StageKind.Info,
    infoLines: [
      '## Welcome to the experiment!\nIn this task, you are adrift on a private yacht in the North Atlantic with your crewmates. As a consequence of a fire of unknown origin, much of the yacht and its contents have been destroyed. The yacht is now slowly sinking. Your location is unclear because of the destruction of critical navigational equipment and because you and the crew were distracted trying to bring the fire under control. Your best estimate is that you are approximately one thousand miles south-southeast of the nearest land. You have a box of matches in your pocket.\n',
      '## How the game is scored:\nThe task is to compare pairs of items depending on how useful they may be to your survival in this scenario. However, your answers are not what matters. You will work with your crewmates to elect a **representative**, who will complete this task on your behalf. *Your payout from this task is dependent on how well the representative does on this task.*',
      '## The next activity:\nOn the next screen, you will complete an example of this task.',
    ],
  },

  '04. Initial survival task': {
    name: '04. Initial survival task',
    description: 'Here is an example task.',
    kind: StageKind.TakeSurvey,
    questions: [
      ...I_RATING_QUESTION_CONFIGS,
      {
        id: 99, // Avoid collision with rating questions id (starting from 0)
        kind: SurveyQuestionKind.Scale,
        questionText:
          'Now that you have a sense of the task, how willing would you be to serve as the representative and complete this task on behalf of your crew?',
        lowerBound: 'I would STRONGLY DISLIKE to be the representative (0/10)',
        upperBound: 'I would STRONGLY LIKE to be the representative (10/10)',
      },
    ],
  },

  '05. Group discussion introduction': {
    name: '05. Group discussion introduction',
    description: 'Here is some context on the discussion.',
    kind: StageKind.Info,
    infoLines: [
      'On the next stage, you will review and discuss your answers to the previous task with your crewmembers.<br/><br/>',
      'Take this opportunity to gauge the abilities of your crewmembers, as you will later vote for the team representative.<br/><br/>',
      "As a reminder, the payoff in this task is <b>only dependent on the representative's performance on the final task</b>.",
    ],
  },

  '06. Group discussion': {
    name: '06. Group discussion',
    kind: StageKind.GroupChat,
    chatId: 'chat-0',
    chatConfig: {
      kind: ChatKind.ChatAboutItems,
      ratingsToDiscuss: INDIVIDUAL_ITEM_PAIRS.map(([i1, i2]) => ({ item1: i1, item2: i2 })),
    },
    mediators: [],
  },

  '07. Post-discussion representative survey': {
    name: '07. Post-discussion representative survey',
    description: 'Now, vote for the representative.',
    kind: StageKind.TakeSurvey,
    questions: [
      {
        id: 0,
        kind: SurveyQuestionKind.Scale,
        questionText:
          "Now that you've gauged the abilities of your crewmembers, how willing would you be to serve as the representative and complete this task on behalf of your crew?",
        lowerBound: 'I would STRONGLY DISLIKE to be the representative (0/10)',
        upperBound: 'I would STRONGLY LIKE to be the representative (10/10)',
      },
    ],
  },

  '08. Updated individual survival task introduction': {
    name: '08. Updated individual survival task introduction',
    description: 'Have you changed your responses?',
    kind: StageKind.Info,
    infoLines: [
      'Now that you have deliberated the item pairs with your crewmates, you have an opportunity to update your initial responses.',
      'On the next stage, you will re-do the initial task.',
    ],
  },

  '09. Updated individual survival task': {
    name: '09. Updated individual survival task',
    kind: StageKind.TakeSurvey,
    questions: [...I_RATING_QUESTION_CONFIGS],
  },

  '10. Representative election': {
    name: '10. Representative election',
    description: 'Vote for the leader.',
    kind: StageKind.VoteForLeader,
  },

  '11. Representative survival task introduction': {
    name: '11. Representative survival task introduction',
    kind: StageKind.Info,
    infoLines: [
      "As we calculate the outcome of the election, please take this time to complete the representative's task.",
      'This is a similar task as before, but with different items.',
      'If you are elected the representative, **your performance on this task will determine the payoffs of you and your crewmembers.**',
    ],
  },

  '12. Representative survival task': {
    name: '12. Representative survival task',
    kind: StageKind.TakeSurvey,
    questions: L_RATING_QUESTION_CONFIGS,
  },

  '13. Representative reveal': {
    name: '13. Representative reveal',
    description: 'The votes are in.',
    kind: StageKind.RevealVoted,
    pendingVoteStageName: '10. Representative election',
  },

  '14. Final survey': {
    name: '14. Final survey',
    kind: StageKind.TakeSurvey,
    questions: [
      {
        id: 0,
        kind: SurveyQuestionKind.Scale,
        questionText: 'Rate how happy you were with the final outcome.',
        lowerBound: 'I was very disappointed (0/10)',
        upperBound: 'I was very happy (10/10)',
      },
    ],
  },
};

const PARTICIPANT_COUNT = 3;

const DEFAULT_EXPERIMENT: Omit<Experiment, 'id'> = {
  name: 'Example experiment',
  date: Timestamp.now(),
  numberOfParticipants: PARTICIPANT_COUNT,
  participants: {}, // Readonly map that will be filled via a firestore hook
};

const DEFAULT_TEMPLATE: Omit<ExperimentTemplate, 'id'> = {
  name: 'Default template',
};

seedDatabase().catch(console.error);
