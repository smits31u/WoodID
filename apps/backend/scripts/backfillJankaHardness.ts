/**
 * Backfills jankaHardness for species where it was left at the 0 placeholder (~801 rows as of
 * the 2026-08-04 data quality check). Asks Claude for the documented Janka hardness; if unknown,
 * or if the returned number is outside a plausible range (likely a hallucination — no wood on
 * record exceeds roughly 5000 lbf), sets hasNoJankaData so future runs don't re-ask.
 *
 * Resumable: candidates are rows where jankaHardness === 0 AND hasNoJankaData is false. A
 * successful update sets jankaHardness > 0 (so it no longer matches) or sets hasNoJankaData (so
 * it's explicitly excluded) — either way a rerun naturally skips it. Rows that fail (API error,
 * unparseable response) are left untouched and will be retried on rerun.
 *
 * Usage:
 *   npx tsx scripts/backfillJankaHardness.ts --limit=25   # test batch
 *   npx tsx scripts/backfillJankaHardness.ts              # full remaining backlog, batches of 100
 */

import { prisma } from '../src/db/client.js';
import { sleep } from '../src/ai/woodProperties.js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BATCH_SIZE = 100;
const PER_CALL_PAUSE_MS = 350;
const BATCH_PAUSE_MS = 2000;
const MIN_PLAUSIBLE_JANKA = 0;
const MAX_PLAUSIBLE_JANKA = 5000;

interface Candidate {
  id: number;
  commonName: string;
  scientificName: string;
  jankaHardness: number;
}

interface RowResult {
  scientificName: string;
  outcome: 'updated' | 'unknown' | 'out_of_range' | 'error';
  value: string;
}

function parseLimitArg(): number | null {
  const arg = process.argv.find((a) => a.startsWith('--limit='));
  if (!arg) return null;
  const n = Number(arg.split('=')[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchJankaHardness(commonName: string, scientificName: string): Promise<string | null> {
  const prompt =
    `What is the Janka hardness rating (in lbf) for the wood species '${scientificName}' ` +
    `(common name: '${commonName}')? If this is not a documented/known value, respond exactly ` +
    'with: UNKNOWN. Otherwise respond with ONLY the number, no units or extra text.';

  let message;
  try {
    message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 32,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (error) {
    console.warn(`  Claude request failed for ${scientificName}:`, error);
    return null;
  }

  const textBlock = message.content.find((block) => block.type === 'text');
  if (!textBlock || !textBlock.text.trim()) {
    console.warn(`  Claude returned no text response for ${scientificName}.`);
    return null;
  }

  return textBlock.text.trim();
}

async function loadCandidates(limit: number | null): Promise<Candidate[]> {
  const rows = await prisma.species.findMany({
    where: { hasNoJankaData: false },
    select: { id: true, commonName: true, scientificName: true, jankaHardness: true },
    orderBy: { id: 'asc' },
  });
  const candidates = rows.filter((r) => r.jankaHardness === 0);
  return limit ? candidates.slice(0, limit) : candidates;
}

async function processRow(candidate: Candidate): Promise<RowResult> {
  const response = await fetchJankaHardness(candidate.commonName, candidate.scientificName);
  if (response === null) {
    return { scientificName: candidate.scientificName, outcome: 'error', value: '(request failed)' };
  }

  if (response.toUpperCase() === 'UNKNOWN') {
    await prisma.species.update({
      where: { id: candidate.id },
      data: { hasNoJankaData: true },
    });
    return { scientificName: candidate.scientificName, outcome: 'unknown', value: 'UNKNOWN' };
  }

  const match = /^-?\d+(\.\d+)?/.exec(response);
  if (!match) {
    return { scientificName: candidate.scientificName, outcome: 'error', value: `(unparseable: "${response}")` };
  }

  const num = Number(match[0]);
  if (num < MIN_PLAUSIBLE_JANKA || num > MAX_PLAUSIBLE_JANKA) {
    await prisma.species.update({
      where: { id: candidate.id },
      data: { hasNoJankaData: true },
    });
    return {
      scientificName: candidate.scientificName,
      outcome: 'out_of_range',
      value: `${num} (rejected, out of 0-5000 range -> flagged UNKNOWN)`,
    };
  }

  const rounded = Math.round(num);
  await prisma.species.update({
    where: { id: candidate.id },
    data: { jankaHardness: rounded },
  });
  return { scientificName: candidate.scientificName, outcome: 'updated', value: String(rounded) };
}

async function main() {
  const limit = parseLimitArg();
  const candidates = await loadCandidates(limit);

  console.log(
    limit
      ? `Test batch: processing ${candidates.length} of the outstanding candidates.\n`
      : `Found ${candidates.length} remaining candidates to process.\n`,
  );

  let updated = 0;
  let unknownFlagged = 0;
  let outOfRangeFlagged = 0;
  let failed = 0;
  const errors: string[] = [];
  const results: RowResult[] = [];

  for (let batchStart = 0; batchStart < candidates.length; batchStart += BATCH_SIZE) {
    const batch = candidates.slice(batchStart, batchStart + BATCH_SIZE);
    const batchNumber = Math.floor(batchStart / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(candidates.length / BATCH_SIZE);
    if (candidates.length > BATCH_SIZE) {
      console.log(`Batch ${batchNumber}/${totalBatches} (${batch.length} species)...`);
    }

    for (const candidate of batch) {
      try {
        const result = await processRow(candidate);
        results.push(result);
        if (result.outcome === 'updated') updated += 1;
        else if (result.outcome === 'unknown') unknownFlagged += 1;
        else if (result.outcome === 'out_of_range') outOfRangeFlagged += 1;
        else {
          failed += 1;
          errors.push(candidate.scientificName);
        }
      } catch (error) {
        failed += 1;
        errors.push(candidate.scientificName);
        console.warn(`  Unexpected error processing ${candidate.scientificName}:`, error);
      }

      const done = updated + unknownFlagged + outOfRangeFlagged + failed;
      console.log(`${done}/${candidates.length} done`);
      await sleep(PER_CALL_PAUSE_MS);
    }

    await sleep(BATCH_PAUSE_MS);
  }

  console.log('\n=== RESULTS ===');
  for (const r of results) {
    console.log(`${r.scientificName} -> ${r.value}`);
  }

  console.log(
    `\nDone. ${updated} updated with a real hardness value, ${unknownFlagged} flagged ` +
      `hasNoJankaData (UNKNOWN), ${outOfRangeFlagged} flagged hasNoJankaData (out-of-range/` +
      `hallucination), ${failed} failed (left untouched — rerun this script to retry them).`,
  );
  if (errors.length) {
    console.log('Failed rows:', errors.join(', '));
  }
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
