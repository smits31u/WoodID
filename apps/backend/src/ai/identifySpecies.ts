import Anthropic, { APIError } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const IDENTIFY_PROMPT =
  'You are a wood species identification expert applying IAWA (International Association of ' +
  'Wood Anatomists) macroscopic description conventions. Examine this wood image and assess, ' +
  'as far as the photo allows: vessel arrangement/porosity (e.g. diffuse-porous, ring-porous, ' +
  'semi-ring-porous), vessel grouping (solitary, radial multiples, clusters) and relative vessel ' +
  'frequency/diameter, ray visibility and spacing on end grain if visible, axial parenchyma ' +
  'pattern (banded, diffuse, paratracheal, absent/not visible), growth ring visibility and ' +
  'distinctness, heartwood/sapwood color and luster, and grain pattern (straight, interlocked, ' +
  'wavy, figured). Use these anatomical features, not just overall color and texture, as the ' +
  'basis for your identification. Return ONLY a JSON object with these fields: commonName ' +
  '(string, the most likely wood species common name), scientificName (string), confidence ' +
  '(number between 0 and 1), reasoning (string, 2-3 sentences explaining what visual features ' +
  'led to this identification), vesselPattern (string, porosity + grouping observed, or "not ' +
  'visible" if the photo does not show end grain clearly), rayVisibility (string, or "not ' +
  'visible"), growthRingVisibility (string, or "not visible"), vesselGrouping (string), ' +
  'parenchymaPattern (string, or "not visible"), colorAndLuster (string), grainPattern (string), ' +
  'estimatedDensityCategory (one of "light", "medium", "heavy" — your best visual estimate of ' +
  'relative wood density from pore density, ray prominence, and color depth; coarse open pores ' +
  'and pale color typically indicate lighter wood, fine dense pores/rays and dark saturated ' +
  'color typically indicate heavier wood). Do not include any other text.';

const MULTI_ANGLE_CONTEXT =
  'You are analyzing multiple angles of the same wood sample. Image 1 is face grain, Image 2 ' +
  'is edge grain, Image 3 is end grain (if provided). Use all available angles to make your ' +
  'identification.';

export type DensityCategory = 'light' | 'medium' | 'heavy';

export interface ClaudeIdentification {
  commonName: string;
  scientificName: string;
  confidence: number;
  reasoning: string;
  // IAWA-style macroscopic observations. Optional: older callers/tests and any response Claude
  // fails to fully populate should still validate on the four fields above.
  vesselPattern?: string;
  rayVisibility?: string;
  growthRingVisibility?: string;
  vesselGrouping?: string;
  parenchymaPattern?: string;
  colorAndLuster?: string;
  grainPattern?: string;
  estimatedDensityCategory?: DensityCategory;
}

const DENSITY_CATEGORIES: readonly DensityCategory[] = ['light', 'medium', 'heavy'];

export class IdentificationError extends Error {}

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export const SUPPORTED_MEDIA_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

export interface ParsedImage {
  base64Data: string;
  mediaType: ImageMediaType;
}

export function parseImageInput(image: string): ParsedImage {
  const dataUriMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(image);
  if (!dataUriMatch) {
    return { base64Data: image, mediaType: 'image/jpeg' };
  }

  const [, declaredType, base64Data] = dataUriMatch;
  const mediaType = SUPPORTED_MEDIA_TYPES.includes(declaredType)
    ? (declaredType as ImageMediaType)
    : 'image/jpeg';

  return { base64Data, mediaType };
}

function stripMarkdownCodeFence(text: string): string {
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text.trim());
  return fenceMatch ? fenceMatch[1] : text;
}

function isClaudeIdentification(value: unknown): value is ClaudeIdentification {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const optionalStringOk = (key: keyof ClaudeIdentification) =>
    candidate[key] === undefined || typeof candidate[key] === 'string';

  return (
    typeof candidate.commonName === 'string' &&
    typeof candidate.scientificName === 'string' &&
    typeof candidate.confidence === 'number' &&
    candidate.confidence >= 0 &&
    candidate.confidence <= 1 &&
    typeof candidate.reasoning === 'string' &&
    optionalStringOk('vesselPattern') &&
    optionalStringOk('rayVisibility') &&
    optionalStringOk('growthRingVisibility') &&
    optionalStringOk('vesselGrouping') &&
    optionalStringOk('parenchymaPattern') &&
    optionalStringOk('colorAndLuster') &&
    optionalStringOk('grainPattern') &&
    (candidate.estimatedDensityCategory === undefined ||
      DENSITY_CATEGORIES.includes(candidate.estimatedDensityCategory as DensityCategory))
  );
}

export async function identifySpeciesFromImages(
  images: ParsedImage[],
): Promise<ClaudeIdentification> {
  const promptText =
    images.length > 1 ? `${MULTI_ANGLE_CONTEXT}\n\n${IDENTIFY_PROMPT}` : IDENTIFY_PROMPT;

  const imageBlocks = images.map((image) => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: image.mediaType, data: image.base64Data },
  }));

  let message;
  try {
    message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1536,
      messages: [
        {
          role: 'user',
          content: [...imageBlocks, { type: 'text', text: promptText }],
        },
      ],
    });
  } catch (error) {
    if (error instanceof APIError) {
      const detail = `${error.type ?? error.name} (status ${error.status ?? 'unknown'}): ${error.message}`;
      console.error('[identifySpecies] Anthropic API error:', detail);
      throw new IdentificationError(`AI identification service error: ${detail}`, { cause: error });
    }

    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error('[identifySpecies] Unexpected error calling Anthropic API:', detail);
    throw new IdentificationError(`Could not reach the AI identification service (${detail}).`, {
      cause: error,
    });
  }

  const textBlock = message.content.find((block) => block.type === 'text');
  if (!textBlock) {
    throw new IdentificationError('The AI identification service returned no text response.');
  }

  console.log('[identifySpecies] raw Claude response:', textBlock.text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownCodeFence(textBlock.text));
  } catch (error) {
    throw new IdentificationError(
      'The AI identification service returned an unparseable response.',
      { cause: error },
    );
  }

  if (!isClaudeIdentification(parsed)) {
    throw new IdentificationError(
      'The AI identification service returned a response in an unexpected shape.',
    );
  }

  return parsed;
}

const IS_WOOD_PROMPT =
  'Look at this image. Is it a photo of a wood surface (grain, boards, cut end, etc.)? ' +
  'Return ONLY a JSON object with one field: isWood (boolean). Do not include any other text.';

function isWoodResult(value: unknown): value is { isWood: boolean } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).isWood === 'boolean'
  );
}

/**
 * A transient failure (network error, unparseable response) returns 'unknown' rather than
 * throwing, so callers can leave the submission pending for a human instead of wrongly
 * auto-rejecting it — only an explicit 'no' from Claude should auto-reject.
 */
export async function isWoodPhoto(image: ParsedImage): Promise<'yes' | 'no' | 'unknown'> {
  let message;
  try {
    message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: image.mediaType, data: image.base64Data },
            },
            { type: 'text', text: IS_WOOD_PROMPT },
          ],
        },
      ],
    });
  } catch (error) {
    console.warn('[isWoodPhoto] Anthropic API request failed:', error);
    return 'unknown';
  }

  const textBlock = message.content.find((block) => block.type === 'text');
  if (!textBlock) {
    console.warn('[isWoodPhoto] Claude returned no text response.');
    return 'unknown';
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownCodeFence(textBlock.text));
  } catch {
    console.warn('[isWoodPhoto] Claude returned unparseable JSON:', textBlock.text);
    return 'unknown';
  }

  if (!isWoodResult(parsed)) {
    console.warn('[isWoodPhoto] Claude returned JSON in an unexpected shape:', textBlock.text);
    return 'unknown';
  }

  return parsed.isWood ? 'yes' : 'no';
}
