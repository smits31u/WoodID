/**
 * Shared download/parse logic for the Tervuren xylarium Wood Density Database (TWDD), Royal
 * Museum for Central Africa — Verbiest et al., Scientific Data (2026),
 * Dryad https://doi.org/10.5061/dryad.31zcrjf1k (CC0 1.0).
 *
 * Downloading this file is non-trivial: Dryad's file-download endpoint sits behind Anubis
 * (https://github.com/TecharoHQ/anubis), a JavaScript SHA-256 proof-of-work bot filter. A plain
 * HTTP request gets an HTML challenge page, not the file. `solveAnubisChallenge` below
 * replicates the exact client-side algorithm (read directly from Dryad's own served
 * `sha256-purejs.mjs` worker script): find a nonce such that SHA256(challenge.randomData +
 * nonce) has `floor(difficulty / 2)` leading zero bytes (plus a leading zero nibble if difficulty
 * is odd), then GET `/.within.website/x/cmd/anubis/api/pass-challenge?id&response&nonce&redir&elapsedTime`
 * to obtain a valid session cookie, then re-request the file with that cookie. This is solving a
 * public, documented, intentionally-solvable-by-any-client proof-of-work puzzle to reach openly
 * licensed public data — not bypassing an access-control boundary. It's also inherently fragile:
 * if Dryad changes their Anubis version/config, this will need updating (the code checks for
 * that and fails loudly rather than silently returning garbage).
 *
 * Extracted from importTWDD.ts so importTWDD.ts and scripts that need TWDD sample counts (as a
 * proxy for how commonly a species is encountered/traded) don't each carry their own copy of the
 * Anubis solver.
 */

import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';

const FILE_STREAM_URL = 'https://datadryad.org/downloads/file_stream/4518853';
const ANUBIS_BASE = 'https://datadryad.org';
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export const TWDD_ATTRIBUTION =
  'Wood density data from the Tervuren xylarium Wood Density Database (TWDD), Royal Museum for Central Africa (CC0 1.0)';

interface AnubisChallenge {
  rules: { algorithm: string; difficulty: number };
  challenge: { id: string; randomData: string };
}

function parseCookies(setCookieHeaders: string[]): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const header of setCookieHeaders) {
    const [pair] = header.split(';');
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    cookies[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return cookies;
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function solveAnubisChallenge(
  randomData: string,
  difficulty: number,
): { hash: string; nonce: number } {
  const fullZeroBytes = Math.floor(difficulty / 2);
  const needsHalfByte = difficulty % 2 !== 0;

  for (let nonce = 0; ; nonce += 1) {
    const digest = createHash('sha256')
      .update(randomData + String(nonce))
      .digest();
    let ok = true;
    for (let i = 0; i < fullZeroBytes; i += 1) {
      if (digest[i] !== 0) {
        ok = false;
        break;
      }
    }
    if (ok && needsHalfByte && digest[fullZeroBytes] >> 4 !== 0) {
      ok = false;
    }
    if (ok) {
      return { hash: digest.toString('hex'), nonce };
    }
  }
}

export async function downloadTWDD(): Promise<Buffer> {
  let cookies: Record<string, string> = {};

  let response = await fetch(FILE_STREAM_URL, {
    headers: { 'User-Agent': USER_AGENT },
  });

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    // No challenge presented (Anubis disabled, or already passed) — this is the real file.
    return Buffer.from(await response.arrayBuffer());
  }

  cookies = { ...cookies, ...parseCookies(response.headers.getSetCookie?.() ?? []) };
  const html = await response.text();
  const match = /id="anubis_challenge" type="application\/json">(.*?)<\/script>/s.exec(html);
  if (!match) {
    throw new Error(
      'Expected an Anubis challenge page but found none, and the response was not the xlsx ' +
        'file either. Dryad may have changed how downloads are protected — this script needs updating.',
    );
  }

  const payload = JSON.parse(match[1]) as AnubisChallenge;
  if (payload.rules.algorithm !== 'fast') {
    throw new Error(
      `Unrecognized Anubis challenge algorithm "${payload.rules.algorithm}" — this script only implements "fast".`,
    );
  }

  const start = Date.now();
  const { hash, nonce } = solveAnubisChallenge(
    payload.challenge.randomData,
    payload.rules.difficulty,
  );
  const elapsedMs = Date.now() - start;

  const passUrl = new URL(`${ANUBIS_BASE}/.within.website/x/cmd/anubis/api/pass-challenge`);
  passUrl.searchParams.set('id', payload.challenge.id);
  passUrl.searchParams.set('response', hash);
  passUrl.searchParams.set('nonce', String(nonce));
  passUrl.searchParams.set('redir', FILE_STREAM_URL);
  passUrl.searchParams.set('elapsedTime', String(elapsedMs));

  const passResponse = await fetch(passUrl, {
    headers: { 'User-Agent': USER_AGENT, Cookie: cookieHeader(cookies) },
    redirect: 'manual',
  });
  cookies = { ...cookies, ...parseCookies(passResponse.headers.getSetCookie?.() ?? []) };

  response = await fetch(FILE_STREAM_URL, {
    headers: { 'User-Agent': USER_AGENT, Cookie: cookieHeader(cookies) },
  });
  const finalContentType = response.headers.get('content-type') ?? '';
  if (finalContentType.includes('text/html')) {
    throw new Error(
      'Still received an HTML page after solving the Anubis challenge — solve likely failed.',
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

export interface TWDDSpeciesAggregate {
  scientificName: string;
  family: string | null;
  genus: string | null;
  region: string | null;
  meanDensity: number;
  sampleCount: number;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim() !== 'NA';
}

export async function parseTWDD(buffer: Buffer): Promise<TWDDSpeciesAggregate[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's own type declarations predate @types/node's generic Buffer<TArrayBuffer> — the
  // runtime shape is identical, just a stricter structural type than the library declares against.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.getWorksheet('TWDD');
  if (!sheet) {
    throw new Error('TWDD sheet not found in the downloaded workbook.');
  }

  // Column indices verified against the sheet's own header row (1-indexed, ExcelJS convention).
  const COL_SPECIES = 2;
  const COL_FAMILY = 5;
  const COL_GENUS = 6;
  const COL_WD_BASIC = 13;
  const COL_REGION = 18;

  interface Accumulator {
    family: Map<string, number>;
    genus: Map<string, number>;
    region: Map<string, number>;
    densities: number[];
  }

  const bySpecies = new Map<string, Accumulator>();

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values as unknown[];
    const species = values[COL_SPECIES];
    if (!isNonEmptyString(species)) return;

    const key = species.trim();
    if (!bySpecies.has(key)) {
      bySpecies.set(key, { family: new Map(), genus: new Map(), region: new Map(), densities: [] });
    }
    const acc = bySpecies.get(key)!;

    const family = values[COL_FAMILY];
    if (isNonEmptyString(family))
      acc.family.set(family.trim(), (acc.family.get(family.trim()) ?? 0) + 1);

    const genus = values[COL_GENUS];
    if (isNonEmptyString(genus))
      acc.genus.set(genus.trim(), (acc.genus.get(genus.trim()) ?? 0) + 1);

    const region = values[COL_REGION];
    if (isNonEmptyString(region))
      acc.region.set(region.trim(), (acc.region.get(region.trim()) ?? 0) + 1);

    const wdBasic = values[COL_WD_BASIC];
    if (typeof wdBasic === 'number' && Number.isFinite(wdBasic)) acc.densities.push(wdBasic);
  });

  function mostCommon(counts: Map<string, number>): string | null {
    let best: string | null = null;
    let bestCount = 0;
    for (const [value, count] of counts) {
      if (count > bestCount) {
        best = value;
        bestCount = count;
      }
    }
    return best;
  }

  const result: TWDDSpeciesAggregate[] = [];
  for (const [scientificName, acc] of bySpecies) {
    if (acc.densities.length === 0) continue;
    const meanDensity = acc.densities.reduce((a, b) => a + b, 0) / acc.densities.length;
    result.push({
      scientificName,
      family: mostCommon(acc.family),
      genus: mostCommon(acc.genus),
      region: mostCommon(acc.region),
      meanDensity,
      sampleCount: acc.densities.length,
    });
  }

  return result;
}
