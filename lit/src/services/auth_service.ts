import { computed, makeObservable, observable } from "mobx";
import {
  Auth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User
} from 'firebase/auth';

import { Service } from "./service";
import { ExperimentService } from "./experiment_service";
import { ExperimenterService } from "./experimenter_service";
import { FirebaseService } from "./firebase_service";

interface ServiceProvider {
  experimentService: ExperimentService;
  experimenterService: ExperimenterService;
  firebaseService: FirebaseService;
}

export class AuthService extends Service {
  constructor(private readonly sp: ServiceProvider) {
    super();
    makeObservable(this);

    onAuthStateChanged(this.sp.firebaseService.auth, (user: User | null) => {
      if (user) {
        // User is signed in, see docs for a list of available properties
        // https://firebase.google.com/docs/reference/js/auth.user
        this.user = user;
        this.user.getIdTokenResult().then((result) => {
          if (result.claims['role'] === 'experimenter') {
            this.isExperimenter = true;
            this.sp.experimenterService.subscribe();
          } else {
            this.isExperimenter = false;
          }
        });
      } else {
        // User is signed out
        this.user = null;
        this.isExperimenter = null;
      }
    });
  }

  @observable user: User|null|undefined = undefined;
  @observable isExperimenter: boolean|null = null;
  @observable canEdit = false;

  @computed get userId() {
    return this.user?.uid;
  }

  @computed get initialAuthCheck() {
    return this.user !== undefined;
  }

  @computed get authenticated() {
    return this.initialAuthCheck && this.user !== null;
  }

  setEditPermissions(canEdit: boolean) {
    this.canEdit = !this.isExperimenter ? false : canEdit;
  }

  signInWithGoogle() {
    signInWithPopup(
      this.sp.firebaseService.auth, this.sp.firebaseService.provider
    );
  }

  signOut() {
    signOut(this.sp.firebaseService.auth);
    this.sp.experimentService.unsubscribeAll();
  }
}
