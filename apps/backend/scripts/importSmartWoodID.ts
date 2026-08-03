/**
 * SCAFFOLDING — NOT VERIFIED, DO NOT RUN AS-IS.
 *
 * This script is a template for importing/enriching species from SmartWoodID
 * (Tervuren Wood Collection, Royal Museum for Central Africa — CC BY 4.0), following
 * the upsert pattern used by importSpecies.ts.
 *
 * It has NOT been run against a real endpoint. What's confirmed vs. not:
 *  - SmartWoodID and the Tervuren xylarium are real (published research: DOI
 *    10.1093/database/baad034 — "SmartWoodID—an image collection of large end-grain
 *    surfaces to support wood identification systems").
 *  - The domain "xylarium.be" (and "www.xylarium.be") does not resolve — no DNS record.
 *  - The paper's own citation for the dataset is a Handle redirect
 *    (hdl.handle.net/20.500.12624/SmartWoodID_first_edition), which currently returns
 *    HTTP 500.
 *  - The system is built on the IIIF Image API + Presentation API (viewed via Mirador),
 *    which serves individual pre-known image manifests — it is NOT a "list/search all
 *    species" REST API. The paper states a search-capable "Content Search API" was only
 *    planned, not built, as of publication (May 2023).
 *  - The CC BY 4.0 license could not be independently verified (the site wasn't reachable).
 *
 * TODO before this can actually run:
 *  1. Find the real base URL for the IIIF service (check with RMCA/Africamuseum directly,
 *     or watch for the Handle redirect coming back online).
 *  2. Confirm whether species-level records are discoverable via a Presentation API
 *     collection manifest (which would list per-item manifest URIs), since there's no
 *     documented search endpoint — this likely means paging through a collection
 *     manifest rather than querying by name.
 *  3. Confirm the actual shape of the IAWA anatomical metadata in each manifest's
 *     annotations (vessel pattern / growth ring / ray visibility fields) — the fields
 *     below are named per the paper's Table 2 categories, not a verified response shape.
 *  4. Confirm the CC BY 4.0 license statement and where the end-grain image URL lives in
 *     the IIIF Image API response (likely a `service` block with an `id`/`@id`, per IIIF
 *     Image API conventions — needs confirming against a real manifest).
 */

import { prisma } from '../src/db/client.js';
import { sleep } from '../src/ai/woodProperties.js';

// TODO: replace with the real, verified base URL once found.
const SMARTWOODID_BASE_URL = 'https://TODO-find-real-endpoint.example/iiif';

const ATTRIBUTION = 'SmartWoodID / Tervuren Wood Collection (CC BY 4.0)';

interface SmartWoodIDRecord {
  commonName: string;
  scientificName: string;
  family: string;
  originRegions: string;
  vesselPattern: string | null;
  growthRingVisibility: string | null;
  rayVisibility: string | null;
  endGrainImageUrl: string | null;
}

/**
 * TODO: this almost certainly needs to walk a IIIF Presentation API collection manifest
 * (paging through `items`) rather than call a single "list species" endpoint — there is
 * no documented search/list REST API for this dataset as of the SmartWoodID paper.
 */
async function fetchSmartWoodIDRecords(): Promise<SmartWoodIDRecord[]> {
  throw new Error(
    'fetchSmartWoodIDRecords is unimplemented — no verified SmartWoodID API endpoint exists. ' +
      'See the file header for what was checked and what remains unknown.',
  );
}

async function upsertRecord(record: SmartWoodIDRecord): Promise<'created' | 'enriched'> {
  const existing = await prisma.species.findUnique({
    where: { scientificName: record.scientificName },
  });

  if (existing) {
    // Enrich only — don't clobber wood-property data that may already exist from the
    // AI-sourced pipeline (see addNorthAmericanSpecies.ts / addMiscSpecies.ts).
    await prisma.species.update({
      where: { scientificName: record.scientificName },
      data: {
        commonName:
          existing.commonName === existing.scientificName ? record.commonName : existing.commonName,
        attribution: ATTRIBUTION,
        vesselPattern: record.vesselPattern,
        growthRingVisibility: record.growthRingVisibility,
        rayVisibility: record.rayVisibility,
        endGrainImageUrl: record.endGrainImageUrl,
      },
    });
    return 'enriched';
  }

  // TODO: a freshly-created species from this source won't have jankaHardness/density/
  // grainType/etc. — decide whether to backfill those via fetchWoodProperties (Haiku) at
  // creation time, matching the existing import scripts, or leave them as placeholders
  // pending manual review, since this source's own anatomical data doesn't map 1:1 onto
  // those fields.
  await prisma.species.create({
    data: {
      commonName: record.commonName,
      scientificName: record.scientificName,
      family: record.family,
      originRegions: record.originRegions,
      jankaHardness: 0,
      density: 0,
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
      vesselPattern: record.vesselPattern,
      growthRingVisibility: record.growthRingVisibility,
      rayVisibility: record.rayVisibility,
      endGrainImageUrl: record.endGrainImageUrl,
    },
  });
  return 'created';
}

async function main() {
  console.log(`Fetching SmartWoodID records from ${SMARTWOODID_BASE_URL}...`);
  const records = await fetchSmartWoodIDRecords();
  console.log(`Found ${records.length} records.\n`);

  let created = 0;
  let enriched = 0;

  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    console.log(`Processing ${i + 1} of ${records.length}: ${record.commonName}`);

    const result = await upsertRecord(record);
    if (result === 'created') {
      created += 1;
    } else {
      enriched += 1;
    }

    await sleep(200);
  }

  console.log(`\nDone. Created ${created}, enriched ${enriched}.`);
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
