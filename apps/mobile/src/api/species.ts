import { API_BASE_URL } from '../constants/api';

export interface IdentifyResult {
  id?: number;
  commonName?: string;
  scientificName?: string;
  jankaHardness?: number;
  grainType?: string;
  sustainabilityStatus?: string;
  confidence: number;
  reasoning?: string;
  noDbMatch?: boolean;
}

export interface SpeciesSummary {
  id: number;
  commonName: string;
  scientificName: string;
  jankaHardness: number;
  grainType: string;
  sustainabilityStatus: string;
}

export type PhotoAngle = 'FACE_GRAIN' | 'EDGE_GRAIN' | 'END_GRAIN';

export interface ReferencePhoto {
  id: number;
  speciesId: number;
  imageUrl: string;
  angle: PhotoAngle;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export class IdentifyError extends Error {}
export class SpeciesFetchError extends Error {}

export async function identifySpecies(base64Images: string[]): Promise<IdentifyResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/species/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: base64Images }),
    });
  } catch {
    throw new IdentifyError(
      'Could not reach the WoodID server. Check your connection and try again.',
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new IdentifyError(body?.message ?? 'Something went wrong identifying this photo.');
  }

  return response.json();
}

export async function listSpecies(): Promise<SpeciesSummary[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/species`);
  } catch {
    throw new SpeciesFetchError(
      'Could not reach the WoodID server. Check your connection and try again.',
    );
  }

  if (!response.ok) {
    throw new SpeciesFetchError('Something went wrong loading the species list.');
  }

  return response.json();
}

export async function getReferencePhotos(speciesId: number): Promise<ReferencePhoto[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/species/${speciesId}/reference-photos?status=APPROVED`);
  } catch {
    throw new SpeciesFetchError(
      'Could not reach the WoodID server. Check your connection and try again.',
    );
  }

  if (!response.ok) {
    throw new SpeciesFetchError('Something went wrong loading reference photos.');
  }

  return response.json();
}
