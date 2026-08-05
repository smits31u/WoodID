import type { IdentifyResult } from '../api/species';
import type { CapturedPhoto } from '../lib/photo';

export type RootStackParamList = {
  Home: undefined;
  Camera: { existingPhotos: CapturedPhoto[] } | undefined;
  Results: { result: IdentifyResult; photos: CapturedPhoto[] };
  ContributePhoto: undefined;
  SuggestSpecies: { prefillCommonName?: string; prefillScientificName?: string } | undefined;
  About: undefined;
  History: undefined;
};
