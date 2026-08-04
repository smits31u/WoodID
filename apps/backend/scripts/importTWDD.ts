/**
 * Imports wood density data from the Tervuren xylarium Wood Density Database (TWDD),
 * Royal Museum for Central Africa — Verbiest et al., Scientific Data (2026),
 * Dryad https://doi.org/10.5061/dryad.31zcrjf1k
 *
 * License: Dryad's own dataset metadata (the `license` field in
 * GET /api/v2/datasets/doi:10.5061/dryad.31zcrjf1k) resolves to CC0 1.0
 * (https://spdx.org/licenses/CC0-1.0.html) — a public domain dedication, not CC BY 4.0. The
 * attribution string below uses the accurate license.
 *
 * Downloading this file is non-trivial (Dryad's file-download endpoint sits behind an Anubis
 * proof-of-work bot filter) — see scripts/lib/twdd.ts for that and the parsing logic, shared
 * with scripts/enrichLightweightSpecies.ts which reuses TWDD sample counts as a prioritization
 * signal.
 *
 * TWDD.xlsx has three sheets: Legend, TWDD (13,332 sample-level rows), and OverviewTable. The
 * TWDD sheet has one row per wood sample, not per species — this script aggregates by species
 * (mean of the `WD_basic` column, "basic wood density" = ovendry mass / green volume, g/cm3,
 * the same basis used for `Species.density` throughout this codebase).
 *
 * Per user instruction: existing species (matched by scientificName) get their density updated;
 * the ~2,850 species not already in the DB are created as lightweight entries (density, family,
 * genus-derived family, and region from TWDD itself) with no AI enrichment — grain/color/uses/
 * hardness are left as explicit placeholders for later enrichment, not guessed.
 */

import { prisma } from '../src/db/client.js';
import { downloadTWDD, parseTWDD, TWDD_ATTRIBUTION, type TWDDSpeciesAggregate } from './lib/twdd.js';

const ATTRIBUTION = TWDD_ATTRIBUTION;

async function upsertSpecies(records: TWDDSpeciesAggregate[]) {
  let updated = 0;
  let created = 0;

  for (const record of records) {
    const existing = await prisma.species.findUnique({
      where: { scientificName: record.scientificName },
    });

    if (existing) {
      await prisma.species.update({
        where: { scientificName: record.scientificName },
        data: {
          density: Math.round(record.meanDensity * 1000) / 1000,
          attribution: ATTRIBUTION,
        },
      });
      updated += 1;
      continue;
    }

    await prisma.species.create({
      data: {
        commonName: record.scientificName, // no common name in TWDD — flagged for later enrichment
        scientificName: record.scientificName,
        family: record.family ?? 'Unknown',
        originRegions: record.region ?? 'Unknown',
        jankaHardness: 0,
        density: Math.round(record.meanDensity * 1000) / 1000,
        grainType: 'Unknown',
        texture: 'Unknown',
        poreStructure: 'Unknown',
        heartwoodColor: 'Unknown',
        sapwoodColor: 'Unknown',
        workabilityRating: 0,
        workabilityNotes: '',
        commonUses: '',
        sustainabilityStatus: 'Unknown',
        citesListed: false,
        attribution: ATTRIBUTION,
      },
    });
    created += 1;
  }

  return { updated, created };
}

async function main() {
  console.log('Downloading TWDD.xlsx from Dryad (solving Anubis proof-of-work challenge)...');
  const buffer = await downloadTWDD();
  console.log(`Downloaded ${buffer.byteLength.toLocaleString()} bytes.`);

  console.log('Parsing and aggregating by species...');
  const records = await parseTWDD(buffer);
  console.log(`Found ${records.length} distinct species with density data.`);

  console.log('Upserting into the database...');
  const { updated, created } = await upsertSpecies(records);

  const total = await prisma.species.count();
  console.log(`\nDone. Updated ${updated} existing species, created ${created} new species.`);
  console.log(`Final species count: ${total}`);
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
