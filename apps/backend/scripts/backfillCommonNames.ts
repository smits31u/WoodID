/**
 * Backfills commonName for species where it was left equal to scientificName (2,376 rows as of
 * the 2026-08-04 data quality check — mostly TWDD-sourced/AI-pipeline species that were never
 * given a real common name). Asks Claude whether a real common/trade name exists; if not, sets
 * hasNoCommonName so future runs don't re-ask.
 *
 * Resumable: candidates are rows where commonName === scientificName AND hasNoCommonName is
 * false. A successful update changes commonName (so the row no longer matches) or sets
 * hasNoCommonName (so it's explicitly excluded) — either way a rerun naturally skips it. Rows
 * that fail (API error, empty response) are left untouched and will be retried on rerun.
 *
 * Usage:
 *   npx tsx scripts/backfillCommonNames.ts --limit=25   # test batch
 *   npx tsx scripts/backfillCommonNames.ts              # full remaining backlog, batches of 100
 */

import { prisma } from '../src/db/client.js';
import { sleep } from '../src/ai/woodProperties.js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BATCH_SIZE = 100;
const PER_CALL_PAUSE_MS = 350;
const BATCH_PAUSE_MS = 2000;

interface Candidate {
  id: number;
  commonName: string;
  scientificName: string;
}

interface RowResult {
  scientificName: string;
  outcome: 'updated' | 'none' | 'error';
  value: string;
}

function parseLimitArg(): number | null {
  const arg = process.argv.find((a) => a.startsWith('--limit='));
  if (!arg) return null;
  const n = Number(arg.split('=')[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cleanResponseText(text: string): string {
  return text.trim().replace(/^["'`]+|["'`]+$/g, '');
}

/**
 * Guards against responses that ignore the "ONLY the common name" instruction (e.g. "X is
 * commonly known as:\n\nY") — those get treated as parse failures (retryable) rather than
 * written to commonName verbatim. A real common/trade name is short, single-line, and doesn't
 * read as a sentence.
 */
// Latin letters (incl. accented), digits, and common name punctuation only — rejects stray
// non-Latin-script characters that have shown up as isolated garbling artifacts in responses
// (e.g. a Tamil letter injected mid-word: "Dந boerbean").
const ALLOWED_NAME_CHARS = /^[A-Za-z0-9À-ſ'’.,()\- ]+$/;

function looksLikeCleanName(text: string): boolean {
  if (!text || text.includes('\n')) return false;
  if (text.length > 60) return false;
  if (/[:;]/.test(text)) return false;
  if (!ALLOWED_NAME_CHARS.test(text)) return false;
  return true;
}

async function fetchCommonName(scientificName: string): Promise<string | null> {
  const prompt =
    `What is the common/trade name for the wood species '${scientificName}'? If there is no ` +
    'real common name in general use (i.e. it\'s only known by its scientific name), respond ' +
    'exactly with: NONE. Otherwise respond with ONLY the common name, nothing else.';

  let message;
  try {
    message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
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

  return cleanResponseText(textBlock.text);
}

async function loadCandidates(limit: number | null): Promise<Candidate[]> {
  const rows = await prisma.species.findMany({
    where: { hasNoCommonName: false },
    select: { id: true, commonName: true, scientificName: true },
    orderBy: { id: 'asc' },
  });
  const candidates = rows.filter((r) => r.commonName === r.scientificName);
  return limit ? candidates.slice(0, limit) : candidates;
}

async function processRow(candidate: Candidate): Promise<RowResult> {
  const response = await fetchCommonName(candidate.scientificName);
  if (response === null) {
    return { scientificName: candidate.scientificName, outcome: 'error', value: '(request failed)' };
  }

  const lines = response.split('\n').map((l) => l.trim()).filter(Boolean);
  const lastLine = lines[lines.length - 1] ?? '';

  if (response.toUpperCase() === 'NONE' || lastLine.toUpperCase() === 'NONE') {
    await prisma.species.update({
      where: { id: candidate.id },
      data: { hasNoCommonName: true },
    });
    return { scientificName: candidate.scientificName, outcome: 'none', value: 'NONE' };
  }

  if (!looksLikeCleanName(response)) {
    return {
      scientificName: candidate.scientificName,
      outcome: 'error',
      value: `(unparseable, not saved: "${response.replace(/\n/g, '\\n')}")`,
    };
  }

  // Claude echoing the scientific name back is functionally a NONE answer — writing it back
  // as commonName would be a no-op that leaves the row matching commonName === scientificName,
  // so it would be endlessly reprocessed by every future run instead of being resolved.
  if (response.toLowerCase() === candidate.scientificName.toLowerCase()) {
    await prisma.species.update({
      where: { id: candidate.id },
      data: { hasNoCommonName: true },
    });
    return { scientificName: candidate.scientificName, outcome: 'none', value: 'NONE (echoed scientific name)' };
  }

  await prisma.species.update({
    where: { id: candidate.id },
    data: { commonName: response },
  });
  return { scientificName: candidate.scientificName, outcome: 'updated', value: response };
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
  let noneFlagged = 0;
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
        else if (result.outcome === 'none') noneFlagged += 1;
        else {
          failed += 1;
          errors.push(candidate.scientificName);
        }
      } catch (error) {
        failed += 1;
        errors.push(candidate.scientificName);
        console.warn(`  Unexpected error processing ${candidate.scientificName}:`, error);
      }

      const done = updated + noneFlagged + failed;
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
    `\nDone. ${updated} updated with a real common name, ${noneFlagged} flagged hasNoCommonName, ` +
      `${failed} failed (left untouched — rerun this script to retry them).`,
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
