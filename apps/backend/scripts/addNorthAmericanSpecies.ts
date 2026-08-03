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

// Species with no existing DB row at all — fetched fresh via Haiku + CITES lookup and created.
interface NewSpecies {
  commonName: string;
  scientificName: string;
  family: string;
  originRegions: string;
}

const NEW_SPECIES: NewSpecies[] = [
  {
    commonName: 'White Spruce',
    scientificName: 'Picea glauca',
    family: 'Pinaceae',
    originRegions: 'Northern North America (Canada, Alaska, northern United States)',
  },
  {
    commonName: 'Black Spruce',
    scientificName: 'Picea mariana',
    family: 'Pinaceae',
    originRegions: 'Northern North America (Canadian and Alaskan boreal forest)',
  },
  {
    commonName: 'Red Spruce',
    scientificName: 'Picea rubens',
    family: 'Pinaceae',
    originRegions: 'Northeastern North America (Appalachians, New England, Maritime Canada)',
  },
  {
    commonName: 'Balsam Fir',
    scientificName: 'Abies balsamea',
    family: 'Pinaceae',
    originRegions: 'Northeastern North America',
  },
  {
    commonName: 'Subalpine Fir',
    scientificName: 'Abies lasiocarpa',
    family: 'Pinaceae',
    originRegions: 'Western North America (Rocky Mountains)',
  },
  {
    commonName: 'Giant Sequoia',
    scientificName: 'Sequoiadendron giganteum',
    family: 'Cupressaceae',
    originRegions: 'Sierra Nevada, California, United States',
  },
  {
    commonName: 'American Beech',
    scientificName: 'Fagus grandifolia',
    family: 'Fagaceae',
    originRegions: 'Eastern North America',
  },
  {
    commonName: 'Black Ash',
    scientificName: 'Fraxinus nigra',
    family: 'Oleaceae',
    originRegions: 'Northeastern North America',
  },
  {
    commonName: 'Blue Ash',
    scientificName: 'Fraxinus quadrangulata',
    family: 'Oleaceae',
    originRegions: 'Central and eastern United States',
  },
  {
    commonName: 'Rock Elm',
    scientificName: 'Ulmus thomasii',
    family: 'Ulmaceae',
    originRegions: 'Eastern North America (Great Lakes region)',
  },
  {
    commonName: 'Bigleaf Maple',
    scientificName: 'Acer macrophyllum',
    family: 'Sapindaceae',
    originRegions: 'Pacific coast of North America',
  },
];

// Species that already exist in the DB (mostly with commonName == scientificName, i.e.
// no real common name) — patched in place with just commonName/originRegions so the
// existing Haiku-sourced wood-property data isn't needlessly re-fetched and overwritten.
interface FixSpecies {
  scientificName: string;
  commonName: string;
  originRegions: string;
}

const FIX_SPECIES: FixSpecies[] = [
  {
    scientificName: 'Pinus strobus',
    commonName: 'Eastern White Pine',
    originRegions: 'Eastern North America',
  },
  {
    scientificName: 'Acer saccharum',
    commonName: 'Sugar Maple',
    originRegions: 'Eastern North America',
  },
  {
    scientificName: 'Acer saccharinum',
    commonName: 'Silver Maple',
    originRegions: 'Eastern North America',
  },
  {
    scientificName: 'Acer rubrum',
    commonName: 'Red Maple',
    originRegions: 'Eastern North America',
  },
  {
    scientificName: 'Juglans nigra',
    commonName: 'Black Walnut',
    originRegions: 'Eastern North America',
  },
  {
    scientificName: 'Carya illinoinensis',
    commonName: 'Pecan',
    originRegions: 'South-central United States',
  },
  {
    scientificName: 'Carya ovata',
    commonName: 'Shagbark Hickory',
    originRegions: 'Eastern North America',
  },
  {
    scientificName: 'Carya glabra',
    commonName: 'Pignut Hickory',
    originRegions: 'Eastern North America',
  },
  {
    scientificName: 'Carya cordiformis',
    commonName: 'Bitternut Hickory',
    originRegions: 'Eastern North America',
  },
  {
    scientificName: 'Sequoia sempervirens',
    commonName: 'Redwood',
    originRegions: 'Coastal California and southwestern Oregon, United States',
  },
  {
    scientificName: 'Chamaecyparis lawsoniana',
    commonName: 'Port Orford Cedar',
    originRegions: 'Southwestern Oregon and northwestern California, United States',
  },
  // Already in the DB as "Cupressus nootkatensis" (a valid synonym of Callitropsis/Chamaecyparis
  // nootkatensis) — keeping the existing scientificName to avoid creating a duplicate row.
  {
    scientificName: 'Cupressus nootkatensis',
    commonName: 'Alaska Yellow Cedar',
    originRegions: 'Pacific Northwest coast, from Oregon to Alaska',
  },
  {
    scientificName: 'Calocedrus decurrens',
    commonName: 'Incense Cedar',
    originRegions: 'Western United States (Oregon, California, Nevada)',
  },
  {
    scientificName: 'Taxodium distichum',
    commonName: 'Baldcypress',
    originRegions: 'Southeastern United States',
  },
  {
    scientificName: 'Tilia americana',
    commonName: 'American Basswood',
    originRegions: 'Eastern North America',
  },
  { scientificName: 'Acer negundo', commonName: 'Box Elder', originRegions: 'North America' },
  {
    scientificName: 'Betula nigra',
    commonName: 'River Birch',
    originRegions: 'Eastern United States',
  },
  {
    scientificName: 'Betula alleghaniensis',
    commonName: 'Yellow Birch',
    originRegions: 'Northeastern North America',
  },
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
        originRegions: fix.originRegions,
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
