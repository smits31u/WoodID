import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const DENSITY_KG_M3_TO_G_CM3 = 1000;

export interface WoodProperties {
  jankaHardness: number;
  density: number;
  grainType: string;
  texture: string;
  workabilityRating: number;
  workabilityNotes: string;
  commonUses: string;
  heartwood: string;
  sapwood: string;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripMarkdownCodeFence(text: string): string {
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text.trim());
  return fenceMatch ? fenceMatch[1] : text;
}

function isWoodProperties(value: unknown): value is WoodProperties {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.jankaHardness === 'number' &&
    typeof candidate.density === 'number' &&
    typeof candidate.grainType === 'string' &&
    typeof candidate.texture === 'string' &&
    typeof candidate.workabilityRating === 'number' &&
    typeof candidate.workabilityNotes === 'string' &&
    typeof candidate.commonUses === 'string' &&
    typeof candidate.heartwood === 'string' &&
    typeof candidate.sapwood === 'string'
  );
}

export async function fetchWoodProperties(
  commonName: string,
  scientificName: string,
): Promise<WoodProperties | null> {
  const prompt =
    `For the wood species ${commonName} (${scientificName}), provide accurate wood ` +
    'properties as JSON only: jankaHardness (integer lbf), density (float kg/m3), grainType ' +
    '(one of: Straight, Interlocked, Wavy, Irregular), texture (one of: Fine, Medium, Coarse), ' +
    'workabilityRating (1-5 where 5 is easiest), workabilityNotes (one sentence), commonUses ' +
    '(comma separated list), heartwood (color description), sapwood (color description). ' +
    'Return only valid JSON.';

  let message;
  try {
    message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (error) {
    console.warn(`  Claude request failed for ${scientificName}:`, error);
    return null;
  }

  const textBlock = message.content.find((block) => block.type === 'text');
  if (!textBlock) {
    console.warn(`  Claude returned no text response for ${scientificName}.`);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownCodeFence(textBlock.text));
  } catch {
    console.warn(`  Claude returned unparseable JSON for ${scientificName}.`);
    return null;
  }

  if (!isWoodProperties(parsed)) {
    console.warn(`  Claude returned JSON in an unexpected shape for ${scientificName}.`);
    return null;
  }

  return parsed;
}

export function mapAppendixToSustainability(appendix: string | null): string {
  switch (appendix) {
    case 'I':
      return 'Endangered';
    case 'II':
      return 'Vulnerable';
    case 'III':
      return 'Near threatened';
    default:
      return 'Least concern';
  }
}
