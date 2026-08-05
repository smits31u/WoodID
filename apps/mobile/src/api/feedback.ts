import { API_BASE_URL } from '../constants/api';

export class FeedbackSubmitError extends Error {}

export async function submitFeedback(params: {
  deviceId: string;
  rating: number;
  actualSpecies?: string;
  speciesId?: number;
  commonName?: string;
  scientificName?: string;
}): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch {
    throw new FeedbackSubmitError(
      'Could not reach the Grainscope server. Check your connection and try again.',
    );
  }

  if (!response.ok) {
    throw new FeedbackSubmitError('Something went wrong submitting your feedback.');
  }
}
