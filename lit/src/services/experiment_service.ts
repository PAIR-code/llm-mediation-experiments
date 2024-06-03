import { computed, observable, makeObservable } from "mobx";

import {
  collection,
  doc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';

import { Service } from "./service";
import { FirebaseService } from "./firebase_service";

import { Snapshot } from "../shared/types";
import { StageConfig } from "@llm-mediation-experiments/utils";

interface ServiceProvider {
  firebaseService: FirebaseService;
}

/** Manages state for current experiment. */
export class ExperimentService extends Service {
  constructor(private readonly sp: ServiceProvider) {
    super();
    makeObservable(this);
  }

  @observable id: string | null = null;
  @observable stageConfigMap: Record<string, StageConfig> = {};
  @observable stageNames: string[] = [];
  @observable unsubscribe: Unsubscribe[] = [];
  @observable isLoading = false;

  setExperimentId(id: string | null) {
    this.id = id;
    this.isLoading = true;
    this.loadStageData();
  }

  loadStageData() {
    this.unsubscribeAll();

    if (this.id === null) {
      this.isLoading = false;
      return;
    }

    // Fetch the experiment config
    this.unsubscribe.push(onSnapshot(
      collection(
        this.sp.firebaseService.firestore, 'experiments', this.id, 'stages'
    ), (snapshot) => {
      let changedDocs = snapshot.docChanges().map((change) => change.doc);
      if (changedDocs.length === 0) {
        changedDocs = snapshot.docs;
      }

      changedDocs.forEach((doc) => {
        const data = doc.data() as StageConfig;
        this.stageConfigMap[doc.id] = data;
      });

      // Load the stage names
      this.stageNames = Object.keys(this.stageConfigMap);
      this.isLoading = false;
    }));
  }

  unsubscribeAll() {
    this.unsubscribe.forEach(unsubscribe => unsubscribe());
    this.unsubscribe = [];

    // Reset stage configs
    this.stageConfigMap = {};
    this.stageNames = [];
  }

  getStage(stageName: string) {
    return this.stageConfigMap[stageName];
  }
}
