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
  // Canonical end-grain reference photo for the matched species (e.g. from a reference wood
  // collection) — distinct from the crowd-sourced ReferencePhoto gallery. Absolute URL, unlike
  // ReferencePhoto.imageUrl which is server-relative. Not populated for any species yet.
  endGrainImageUrl?: string;
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

/**
 * 'NETWORK_ERROR' is determined client-side (the fetch itself threw). The others are read from
 * the server's `code` field; 'SERVER_ERROR' is the fallback for a non-OK response with no
 * recognized code (e.g. Fastify's own validation error responses, which predate this field).
 */
export type IdentifyErrorCode =
  | 'NETWORK_ERROR'
  | 'IMAGE_QUALITY_REJECTED'
  | 'AI_SERVICE_ERROR'
  | 'SERVER_ERROR';

export class IdentifyError extends Error {
  readonly code: IdentifyErrorCode;

  constructor(message: string, code: IdentifyErrorCode) {
    super(message);
    this.code = code;
  }
}
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
      'Could not reach the Grainscope server. Check your connection and try again.',
      'NETWORK_ERROR',
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const code: IdentifyErrorCode =
      body?.code === 'IMAGE_QUALITY_REJECTED' || body?.code === 'AI_SERVICE_ERROR'
        ? body.code
        : 'SERVER_ERROR';
    throw new IdentifyError(body?.message ?? 'Something went wrong identifying this photo.', code);
  }

  return response.json();
}

export async function listSpecies(): Promise<SpeciesSummary[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/species`);
  } catch {
    throw new SpeciesFetchError(
      'Could not reach the Grainscope server. Check your connection and try again.',
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
      'Could not reach the Grainscope server. Check your connection and try again.',
    );
  }

  if (!response.ok) {
    throw new SpeciesFetchError('Something went wrong loading reference photos.');
  }

  return response.json();
}
