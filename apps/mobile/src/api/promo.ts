import { API_BASE_URL } from '../constants/api';

export class PromoValidationError extends Error {}

export async function validatePromoCode(
  code: string,
  deviceId: string,
): Promise<{ valid: boolean; message?: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/promo/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, deviceId }),
    });
  } catch {
    throw new PromoValidationError(
      'Could not reach the Grainscope server. Check your connection and try again.',
    );
  }

  if (!response.ok) {
    throw new PromoValidationError('Something went wrong checking that code.');
  }

  return response.json();
}
