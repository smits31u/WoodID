import { API_BASE_URL } from '../constants/api';
import type { CapturedPhoto } from '../lib/photo';
import type { PhotoAngle, ReferencePhoto } from './species';

export class ContributionError extends Error {}

// React Native's fetch/FormData accepts { uri, name, type } file objects at runtime, but
// TS resolves the DOM lib's Blob-only FormData.append signature — hence the cast.
function photoFormFile(photo: CapturedPhoto, filename: string): Blob {
  return { uri: photo.uri, name: filename, type: 'image/jpeg' } as unknown as Blob;
}

async function postMultipart(path: string, formData: FormData): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', body: formData });
  } catch {
    throw new ContributionError(
      'Could not reach the WoodID server. Check your connection and try again.',
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ContributionError(body?.message ?? 'Something went wrong submitting this.');
  }

  return response;
}

export async function submitReferencePhoto(params: {
  speciesId: number;
  angle: PhotoAngle;
  deviceId: string;
  photo: CapturedPhoto;
}): Promise<ReferencePhoto> {
  const formData = new FormData();
  formData.append('speciesId', String(params.speciesId));
  formData.append('angle', params.angle);
  formData.append('deviceId', params.deviceId);
  formData.append('photo', photoFormFile(params.photo, 'photo.jpg'));

  const response = await postMultipart('/reference-photos', formData);
  return response.json();
}

export interface SpeciesSuggestionResult {
  id: number;
  proposedCommonName: string;
  proposedScientificName: string | null;
  submitterNotes: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export async function submitSpeciesSuggestion(params: {
  proposedCommonName: string;
  proposedScientificName?: string;
  submitterNotes?: string;
  deviceId: string;
  photos: CapturedPhoto[];
}): Promise<SpeciesSuggestionResult> {
  const formData = new FormData();
  formData.append('proposedCommonName', params.proposedCommonName);
  if (params.proposedScientificName) {
    formData.append('proposedScientificName', params.proposedScientificName);
  }
  if (params.submitterNotes) {
    formData.append('submitterNotes', params.submitterNotes);
  }
  formData.append('deviceId', params.deviceId);
  params.photos.forEach((photo, index) => {
    formData.append('photos', photoFormFile(photo, `photo-${index}.jpg`));
  });

  const response = await postMultipart('/species-suggestions', formData);
  return response.json();
}
