import { prisma } from '../src/db/client.js';
import {
  DENSITY_KG_M3_TO_G_CM3,
  fetchWoodProperties,
  mapAppendixToSustainability,
  sleep,
} from '../src/ai/woodProperties.js';

const CITES_API_BASE = 'https://api.speciesplus.net/api/v1/taxon_concepts';

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

async function fetchCitesStatus(scientificName: string): Promise<CitesResult> {
  const token = process.env.CITES_API_TOKEN;
  const notListed: CitesResult = { citesListed: false, sustainabilityStatus: 'Least concern' };

  if (!token) {
    return notListed;
  }

  let response: Response;
  try {
    response = await fetch(`${CITES_API_BASE}?name=${encodeURIComponent(scientificName)}`, {
      headers: { 'X-Authentication-Token': token },
    });
  } catch (error) {
    console.warn(`  CITES lookup for ${scientificName} failed to connect:`, error);
    return notListed;
  }

  if (!response.ok) {
    console.warn(`  CITES lookup for ${scientificName} failed: HTTP ${response.status}`);
    return notListed;
  }

  const body = (await response.json()) as CitesResponse;
  const listing = body.taxon_concepts?.[0]?.cites_listing;
  if (!listing) {
    return notListed;
  }

  const primaryAppendix = listing.split('/')[0]?.trim() ?? null;
  return { citesListed: true, sustainabilityStatus: mapAppendixToSustainability(primaryAppendix) };
}

interface NewSpecies {
  commonName: string;
  scientificName: string;
  family: string;
  originRegions: string;
}

const NEW_SPECIES: NewSpecies[] = [
  {
    commonName: 'Australian Blackwood',
    scientificName: 'Acacia melanoxylon',
    family: 'Fabaceae',
    originRegions: 'Southeastern Australia and Tasmania',
  },
  {
    commonName: 'Camphor',
    scientificName: 'Cinnamomum camphora',
    family: 'Lauraceae',
    originRegions: 'East Asia (China, Japan, Taiwan)',
  },
  {
    commonName: 'Hawaiian Koa',
    scientificName: 'Acacia koa',
    family: 'Fabaceae',
    originRegions: 'Hawaiian Islands (endemic)',
  },
  {
    commonName: 'Lacewood',
    scientificName: 'Roupala montana',
    family: 'Proteaceae',
    originRegions: 'South America (Brazil)',
  },
  {
    commonName: 'Western Larch',
    scientificName: 'Larix occidentalis',
    family: 'Pinaceae',
    originRegions: 'Pacific Northwest United States and southeastern British Columbia, Canada',
  },
  {
    commonName: 'Ziricote',
    scientificName: 'Cordia dodecandra',
    family: 'Boraginaceae',
    originRegions: 'Mexico (Yucatan Peninsula) and Central America',
  },
  {
    commonName: 'Briar',
    scientificName: 'Erica arborea',
    family: 'Ericaceae',
    originRegions: 'Mediterranean region',
  },
];

// Existing rows patched with a proper common name (and, in one case, no rename needed) —
// same minimal in-place update as the previous cleanup pass, preserving existing wood data.
interface FixSpecies {
  scientificName: string;
  commonName: string;
  originRegions?: string;
}

const FIX_SPECIES: FixSpecies[] = [
  {
    scientificName: 'Thuja plicata',
    commonName: 'Western Red Cedar',
    originRegions: 'Pacific Northwest, United States and Canada',
  },
  {
    scientificName: 'Swietenia macrophylla',
    commonName: 'Big-leaf Mahogany',
    originRegions: 'Central and South America',
  },
  {
    scientificName: 'Betula papyrifera',
    commonName: 'Paper Birch',
    originRegions: 'Northern North America',
  },
  // "Gonçalo Alves" is the trade name for this species (also sometimes applied to the
  // closely related Astronium fraxinifolium) — reusing the existing row rather than
  // creating a duplicate under a different Astronium species.
  { scientificName: 'Astronium graveolens', commonName: 'Gonçalo Alves' },
  { scientificName: 'Diospyros virginiana', commonName: 'American Persimmon' },
  { scientificName: 'Diospyros kaki', commonName: 'Japanese Persimmon' },
];

async function createNewSpecies() {
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < NEW_SPECIES.length; i += 1) {
    const candidate = NEW_SPECIES[i];
    console.log(`Creating ${i + 1} of ${NEW_SPECIES.length}: ${candidate.commonName}`);

    const woodProperties = await fetchWoodProperties(
      candidate.commonName,
      candidate.scientificName,
    );
    if (!woodProperties) {
      console.warn(`  Skipping ${candidate.commonName} — no wood properties returned.`);
      skipped += 1;
      continue;
    }

    const cites = await fetchCitesStatus(candidate.scientificName);

    await prisma.species.upsert({
      where: { scientificName: candidate.scientificName },
      update: {
        commonName: candidate.commonName,
        family: candidate.family,
        originRegions: candidate.originRegions,
        jankaHardness: Math.round(woodProperties.jankaHardness),
        density: woodProperties.density / DENSITY_KG_M3_TO_G_CM3,
        grainType: woodProperties.grainType,
        texture: woodProperties.texture,
        poreStructure: 'Unknown',
        heartwoodColor: woodProperties.heartwood,
        sapwoodColor: woodProperties.sapwood,
        workabilityRating: Math.round(woodProperties.workabilityRating),
        workabilityNotes: woodProperties.workabilityNotes,
        commonUses: woodProperties.commonUses,
        sustainabilityStatus: cites.sustainabilityStatus,
        citesListed: cites.citesListed,
      },
      create: {
        commonName: candidate.commonName,
        scientificName: candidate.scientificName,
        family: candidate.family,
        originRegions: candidate.originRegions,
        jankaHardness: Math.round(woodProperties.jankaHardness),
        density: woodProperties.density / DENSITY_KG_M3_TO_G_CM3,
        grainType: woodProperties.grainType,
        texture: woodProperties.texture,
        poreStructure: 'Unknown',
        heartwoodColor: woodProperties.heartwood,
        sapwoodColor: woodProperties.sapwood,
        workabilityRating: Math.round(woodProperties.workabilityRating),
        workabilityNotes: woodProperties.workabilityNotes,
        commonUses: woodProperties.commonUses,
        sustainabilityStatus: cites.sustainabilityStatus,
        citesListed: cites.citesListed,
      },
    });
    created += 1;

    await sleep(300);
  }

  console.log(`Created/updated ${created} new species, skipped ${skipped}.\n`);
}

async function fixExistingSpecies() {
  let fixed = 0;
  let missing = 0;

  for (const fix of FIX_SPECIES) {
    const existing = await prisma.species.findUnique({
      where: { scientificName: fix.scientificName },
    });
    if (!existing) {
      console.warn(`  No existing row found for ${fix.scientificName} — skipping fix.`);
      missing += 1;
      continue;
    }

    await prisma.species.update({
      where: { scientificName: fix.scientificName },
      data: {
        commonName: fix.commonName,
        ...(fix.originRegions ? { originRegions: fix.originRegions } : {}),
      },
    });
    console.log(`Fixed ${fix.scientificName} -> "${fix.commonName}"`);
    fixed += 1;
  }

  console.log(`\nFixed ${fixed} existing species, ${missing} not found.\n`);
}

async function main() {
  console.log('=== Fixing existing Latin-only entries ===\n');
  await fixExistingSpecies();

  console.log('=== Creating new species ===\n');
  await createNewSpecies();
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
