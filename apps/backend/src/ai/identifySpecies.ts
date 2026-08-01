import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const IDENTIFY_PROMPT =
  'You are a wood species identification expert. Analyze this wood grain image carefully. ' +
  'Look at the grain pattern, pore structure, color, and texture. Return ONLY a JSON object ' +
  'with these fields: commonName (string, the most likely wood species common name), ' +
  'scientificName (string), confidence (number between 0 and 1), reasoning (string, 2-3 ' +
  'sentences explaining what visual features led to this identification). Do not include ' +
  'any other text.';

const MULTI_ANGLE_CONTEXT =
  'You are analyzing multiple angles of the same wood sample. Image 1 is face grain, Image 2 ' +
  'is edge grain, Image 3 is end grain (if provided). Use all available angles to make your ' +
  'identification.';

export interface ClaudeIdentification {
  commonName: string;
  scientificName: string;
  confidence: number;
  reasoning: string;
}

export class IdentificationError extends Error {}

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

const SUPPORTED_MEDIA_TYPES: readonly string[] = [
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
  return (
    typeof candidate.commonName === 'string' &&
    typeof candidate.scientificName === 'string' &&
    typeof candidate.confidence === 'number' &&
    candidate.confidence >= 0 &&
    candidate.confidence <= 1 &&
    typeof candidate.reasoning === 'string'
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
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [...imageBlocks, { type: 'text', text: promptText }],
        },
      ],
    });
  } catch (error) {
    throw new IdentificationError('Could not reach the AI identification service.', {
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
