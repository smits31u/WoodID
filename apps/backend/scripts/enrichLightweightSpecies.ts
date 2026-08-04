/**
 * Enriches the ~2,850 lightweight species created by importTWDD.ts (density/family/region from
 * TWDD only; grainType/texture/jankaHardness/etc. left as explicit placeholders) with a Haiku
 * lookup, the same pattern used by addNorthAmericanSpecies.ts and addMiscSpecies.ts.
 *
 * Density is NOT overwritten — TWDD's measured value is more reliable than an LLM guess, so only
 * jankaHardness/grainType/texture/workability/commonUses/heartwood/sapwood/commonName/CITES
 * status come from this pass.
 *
 * Placeholder rows are identified by grainType === 'Unknown' && jankaHardness === 0, the exact
 * signature importTWDD.ts writes and no other import script produces.
 *
 * Processing order: species are ranked by their TWDD sample count (re-derived by re-downloading
 * and parsing TWDD.xlsx — cheap, a few seconds) as a proxy for how commonly a species is
 * encountered/traded — a species logged by dozens of xylarium samples is far more likely to be
 * commercially or scientifically significant than one logged once. Sample counts aren't stored
 * in the DB (only the aggregate density is), so this script re-derives them purely to decide
 * processing order; nothing about the re-download is persisted.
 *
 * This is a long-running script (2,850 Haiku + CITES lookups) — run it in the background and
 * check `enrichedCount`/`total remaining` in the log, or query the DB directly:
 *   SELECT count(*) FROM "Species" WHERE "grainType" = 'Unknown' AND "jankaHardness" = 0;
 */

import { prisma } from '../src/db/client.js';
import { downloadTWDD, parseTWDD } from './lib/twdd.js';
import { sleep } from '../src/ai/woodProperties.js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CITES_API_BASE = 'https://api.speciesplus.net/api/v1/taxon_concepts';
const ATTRIBUTION =
  'Wood properties from Claude (Anthropic) general knowledge, applied to a species first ' +
  'catalogued via the Tervuren xylarium Wood Density Database (TWDD)';
const BATCH_SIZE = 25;
const BATCH_PAUSE_MS = 2000;
const PER_CALL_PAUSE_MS = 350;

interface CitesResult {
  citesListed: boolean;
  sustainabilityStatus: string;
}
interface CitesTaxonConcept {
  cites_listing?: string | null;
}
interface CitesResponse {
  taxon_concepts?: CitesTaxonConcept[];
}

function mapAppendixToSustainability(appendix: string | null): string {
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

async function fetchCitesStatus(scientificName: string): Promise<CitesResult> {
  const token = process.env.CITES_API_TOKEN;
  const notListed: CitesResult = { citesListed: false, sustainabilityStatus: 'Least concern' };
  if (!token) return notListed;

  let response: Response;
  try {
    response = await fetch(`${CITES_API_BASE}?name=${encodeURIComponent(scientificName)}`, {
      headers: { 'X-Authentication-Token': token },
    });
  } catch {
    return notListed;
  }
  if (!response.ok) return notListed;

  const body = (await response.json()) as CitesResponse;
  const listing = body.taxon_concepts?.[0]?.cites_listing;
  if (!listing) return notListed;
  const primaryAppendix = listing.split('/')[0]?.trim() ?? null;
  return { citesListed: true, sustainabilityStatus: mapAppendixToSustainability(primaryAppendix) };
}

interface PlaceholderEnrichment {
  commonName: string;
  jankaHardness: number;
  grainType: string;
  texture: string;
  workabilityRating: number | null;
  workabilityNotes: string;
  commonUses: string;
  heartwood: string;
  sapwood: string;
}

function stripMarkdownCodeFence(text: string): string {
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text.trim());
  return fenceMatch ? fenceMatch[1] : text;
}

/**
 * jankaHardness/workabilityRating are nullable: for genuinely obscure species Claude correctly
 * returns null for these rather than inventing a precise number it doesn't know (verified by
 * hand against several failed species — e.g. "Limited published data on workability
 * characteristics for this species" alongside jankaHardness: null). The original validator
 * required both to be numbers and discarded the whole response — including perfectly good
 * commonName/grainType/texture/colors/uses — whenever either was null, which was the cause of
 * most of the first run's failures. Null is now accepted and written through as 0 (the existing
 * placeholder value), so the rest of the response still gets saved.
 */
function isPlaceholderEnrichment(value: unknown): value is PlaceholderEnrichment {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.commonName === 'string' &&
    (typeof c.jankaHardness === 'number' || c.jankaHardness === null) &&
    typeof c.grainType === 'string' &&
    typeof c.texture === 'string' &&
    (typeof c.workabilityRating === 'number' || c.workabilityRating === null) &&
    typeof c.workabilityNotes === 'string' &&
    typeof c.commonUses === 'string' &&
    typeof c.heartwood === 'string' &&
    typeof c.sapwood === 'string'
  );
}

/**
 * Unlike fetchWoodProperties (used for species that already have a known common name), TWDD's
 * placeholder rows have scientificName standing in for commonName — this asks Claude to supply a
 * real common name too, falling back to the scientific name for species with no widely-used one
 * (common for African timber species logged mainly under trade/scientific names).
 */
async function fetchPlaceholderEnrichment(
  scientificName: string,
): Promise<PlaceholderEnrichment | null> {
  const prompt =
    `For the wood species with scientific name ${scientificName}, provide accurate wood ` +
    'properties as JSON only: commonName (the most widely used English common/trade name; if ' +
    `none is well established, return "${scientificName}" unchanged), jankaHardness (integer ` +
    'lbf, or null if not confidently known), grainType (one of: Straight, Interlocked, Wavy, ' +
    'Irregular), texture (one of: Fine, Medium, Coarse), workabilityRating (1-5 where 5 is ' +
    'easiest, or null if not confidently known), workabilityNotes (one sentence), commonUses ' +
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

  if (!isPlaceholderEnrichment(parsed)) {
    console.warn(`  Claude returned JSON in an unexpected shape for ${scientificName}.`);
    return null;
  }

  return parsed;
}

async function loadSampleCounts(): Promise<Map<string, number>> {
  console.log('Re-downloading TWDD.xlsx to derive sample counts for prioritization...');
  const buffer = await downloadTWDD();
  const records = await parseTWDD(buffer);
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.scientificName, record.sampleCount);
  }
  console.log(`Loaded sample counts for ${counts.size} species.`);
  return counts;
}

async function main() {
  const sampleCounts = await loadSampleCounts();

  const placeholders = await prisma.species.findMany({
    where: { grainType: 'Unknown', jankaHardness: 0 },
    select: { id: true, scientificName: true },
  });

  placeholders.sort(
    (a, b) => (sampleCounts.get(b.scientificName) ?? 0) - (sampleCounts.get(a.scientificName) ?? 0),
  );

  console.log(`Found ${placeholders.length} placeholder species to enrich.\n`);

  let enriched = 0;
  let failed = 0;

  for (let batchStart = 0; batchStart < placeholders.length; batchStart += BATCH_SIZE) {
    const batch = placeholders.slice(batchStart, batchStart + BATCH_SIZE);
    const batchNumber = Math.floor(batchStart / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(placeholders.length / BATCH_SIZE);
    console.log(`Batch ${batchNumber}/${totalBatches} (${batch.length} species)...`);

    for (const species of batch) {
      const enrichment = await fetchPlaceholderEnrichment(species.scientificName);
      if (!enrichment) {
        failed += 1;
        continue;
      }
      const cites = await fetchCitesStatus(species.scientificName);

      await prisma.species.update({
        where: { id: species.id },
        data: {
          commonName: enrichment.commonName,
          jankaHardness: enrichment.jankaHardness == null ? 0 : Math.round(enrichment.jankaHardness),
          grainType: enrichment.grainType,
          texture: enrichment.texture,
          heartwoodColor: enrichment.heartwood,
          sapwoodColor: enrichment.sapwood,
          workabilityRating:
            enrichment.workabilityRating == null ? 0 : Math.round(enrichment.workabilityRating),
          workabilityNotes: enrichment.workabilityNotes,
          commonUses: enrichment.commonUses,
          sustainabilityStatus: cites.sustainabilityStatus,
          citesListed: cites.citesListed,
          attribution: ATTRIBUTION,
        },
      });
      enriched += 1;
      await sleep(PER_CALL_PAUSE_MS);
    }

    console.log(`  Progress: ${enriched} enriched, ${failed} failed, ${placeholders.length - enriched - failed} remaining.`);
    await sleep(BATCH_PAUSE_MS);
  }

  console.log(`\nDone. Enriched ${enriched} species, ${failed} failed (left as placeholders — rerun this script to retry them).`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
