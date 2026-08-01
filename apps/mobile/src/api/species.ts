const API_BASE_URL = 'http://192.168.0.126:3000';

export interface IdentifyResult {
  commonName?: string;
  scientificName?: string;
  jankaHardness?: number;
  grainType?: string;
  sustainabilityStatus?: string;
  confidence: number;
  reasoning?: string;
  noDbMatch?: boolean;
}

export class IdentifyError extends Error {}

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
