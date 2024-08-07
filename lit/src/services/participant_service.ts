import {
  LostAtSeaQuestionAnswer,
  PARTICIPANT_COMPLETION_TYPE,
  ParticipantProfile,
  ParticipantProfileBase,
  QuestionAnswer,
  StageAnswer,
  StageKind,
  lookupTable,
} from '@llm-mediation-experiments/utils';
import {
  Timestamp,
  Unsubscribe,
  collection,
  doc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import {computed, makeObservable, observable} from 'mobx';
import {updateStageCallable} from '../shared/callables';
import {FirebaseService} from './firebase_service';
import {RouterService} from './router_service';
import {Service} from './service';

interface ServiceProvider {
  firebaseService: FirebaseService;
  routerService: RouterService;
}

export class ParticipantService extends Service {
  constructor(private readonly sp: ServiceProvider) {
    super();
    makeObservable(this);
  }

  @observable experimentId: string | null = null;
  @observable participantId: string | null = null;

  @observable profile: ParticipantProfile | undefined = undefined;
  @observable stageAnswers: Record<string, StageAnswer | undefined> = {};

  // Loading
  @observable unsubscribe: Unsubscribe[] = [];
  @observable isProfileLoading = false;
  @observable areAnswersLoading = false;

  @computed get isLoading() {
    return this.isProfileLoading || this.areAnswersLoading;
  }

  set isLoading(value: boolean) {
    this.isProfileLoading = value;
    this.areAnswersLoading = value;
  }

  setParticipant(experimentId: string | null, participantId: string | null) {
    this.experimentId = experimentId;
    this.participantId = participantId;
    this.isLoading = true;
    this.loadParticipantData();
  }

  isCurrentStage(
    stageId: string = this.sp.routerService.activeRoute.params['stage']
  ) {
    return this.profile?.currentStageId === stageId;
  }

  updateForCurrentRoute() {
    const eid = this.sp.routerService.activeRoute.params['experiment'];
    const pid = this.sp.routerService.activeRoute.params['participant'];
    if (eid !== this.experimentId || pid !== this.participantId) {
      this.setParticipant(eid, pid);
    }
  }

  loadParticipantData() {
    this.unsubscribeAll();

    if (this.experimentId === null || this.participantId === null) {
      this.isLoading = false;
      return;
    }

    // Subscribe to the participant profile
    this.unsubscribe.push(
      onSnapshot(
        doc(
          this.sp.firebaseService.firestore,
          'experiments',
          this.experimentId,
          'participants',
          this.participantId
        ),
        (doc) => {
          this.profile = doc.data() as ParticipantProfile;
          this.isProfileLoading = false;
        }
      )
    );

    // Subscribe to the stage answers
    this.unsubscribe.push(
      onSnapshot(
        collection(
          this.sp.firebaseService.firestore,
          'experiments',
          this.experimentId,
          'participants',
          this.participantId,
          'stages'
        ),
        (snapshot) => {
          let changedDocs = snapshot.docChanges().map((change) => change.doc);
          if (changedDocs.length === 0) changedDocs = snapshot.docs;

          // Update the public stage data signals
          changedDocs.forEach((doc) => {
            this.stageAnswers[doc.id] = doc.data() as StageAnswer;
          });
          this.areAnswersLoading = false;
        }
      )
    );
  }

  unsubscribeAll() {
    this.unsubscribe.forEach((unsubscribe) => unsubscribe());
    this.unsubscribe = [];

    this.profile = undefined;
    this.stageAnswers = {};
  }

  // ******************************************************************************************* //
  //                                          MUTATIONS                                          //
  // ******************************************************************************************* //

  /** Update this participants's profile and acceptance of the Terms of Service.
   * @rights Participant
   */
  async updateProfile(data: Partial<ParticipantProfileBase>) {
    return updateDoc(
      doc(
        this.sp.firebaseService.firestore,
        'experiments',
        this.experimentId!,
        'participants',
        this.participantId!
      ),
      data
    );
  }

  /** Mark a participant as having finished the experiment
   * @rights Participant
   */
  async markExperimentCompleted(
    completionType: PARTICIPANT_COMPLETION_TYPE | null = null
  ) {
    return updateDoc(
      doc(
        this.sp.firebaseService.firestore,
        'experiments',
        this.experimentId!,
        'participants',
        this.participantId!
      ),
      {
        completedExperiment: Timestamp.now(),
        completionType: completionType ?? PARTICIPANT_COMPLETION_TYPE.SUCCESS,
      }
    );
  }

  /** Update this participant's `currentStageId`
   * @rights Participant
   */
  async updateCurrentStageId(stageId: string) {
    return updateDoc(
      doc(
        this.sp.firebaseService.firestore,
        'experiments',
        this.experimentId!,
        'participants',
        this.participantId!
      ),
      {
        currentStageId: stageId,
      }
    );
  }

  /** Update a survey stage for this participant
   * @rights Participant
   */
  async updateSurveyStage(stageId: string, answers: QuestionAnswer[]) {
    return updateStageCallable(this.sp.firebaseService.functions, {
      experimentId: this.experimentId!,
      participantId: this.participantId!,
      stageId,
      stage: {
        kind: StageKind.TakeSurvey,
        answers: lookupTable(answers, 'id'),
      },
    });
  }

  /** Update a WTL survey stage for this participant
   *  @rights Participants
   */
  async updateWTLSurveyStage(
    stageId: string,
    score: number
  ) {
    return updateStageCallable(this.sp.firebaseService.functions, {
      experimentId: this.experimentId!,
      participantId: this.participantId!,
      stageId,
      stage: {
        kind: StageKind.WTLSurvey,
        score
      }
    });
  }

  /** Update a Lost at Sea survey stage for this participant
   * @rights Participant
   */
  async updateLostAtSeaSurveyStage(
    stageId: string,
    answers: LostAtSeaQuestionAnswer[]
  ) {
    return updateStageCallable(this.sp.firebaseService.functions, {
      experimentId: this.experimentId!,
      participantId: this.participantId!,
      stageId,
      stage: {
        kind: StageKind.LostAtSeaSurvey,
        answers: lookupTable(answers, 'id'),
      },
    });
  }

  /** Update a vote for leader stage for this participant
   * @rights Participant
   */
  async updateVoteForLeaderStage(stageId: string, rankings: string[]) {
    return updateStageCallable(this.sp.firebaseService.functions, {
      experimentId: this.experimentId!,
      participantId: this.participantId!,
      stageId,
      stage: {
        kind: StageKind.VoteForLeader,
        rankings,
      },
    });
  }
}
