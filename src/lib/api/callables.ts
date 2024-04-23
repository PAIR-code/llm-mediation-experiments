/** Firebase cloud function callables */

import { HttpsCallableResult, httpsCallable } from 'firebase/functions';
import { CreationResponse, SimpleResponse } from '../types/api.types';
import { Experiment, ExperimentCreationData, ExperimentExtended } from '../types/experiments.types';
import { functions } from './firebase';

/** Wrapper to extract the data attribute from all callable cloud functions */
const data =
  <TArgs, TReturn>(f: (args?: TArgs) => Promise<HttpsCallableResult<TReturn>>) =>
  (args?: TArgs) =>
    f(args).then((r) => r.data);

export const experimentsCallable = data(
  httpsCallable<never, SimpleResponse<Experiment[]>>(functions, 'experiments'),
);

export const experimentCallable = data(
  httpsCallable<{ experimentUid: string }, ExperimentExtended>(functions, 'experiment'),
);

export const deleteExperimentCallable = data(
  httpsCallable<{ experimentId: string }, SimpleResponse<string>>(functions, 'deleteExperiment'),
);

export const createExperimentCallable = data(
  httpsCallable<ExperimentCreationData, CreationResponse>(functions, 'createExperiment'),
);
