import type { IdentifyResult } from '../api/species';

export type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Results: { result: IdentifyResult };
  ContributePhoto: undefined;
  SuggestSpecies: { prefillCommonName?: string; prefillScientificName?: string } | undefined;
};
