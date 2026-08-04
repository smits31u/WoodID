/**
 * Fixes a gap in importUSDAWoodHandbookTables54_55.ts's Table 5-4 pass: that script only
 * updates existing DB rows and correctly skips species it doesn't find, but 5 of Table 5-4's
 * species (Bigtooth Aspen, Balsam Poplar, Black Cottonwood, Jack Pine, Red Pine) aren't in the
 * DB at all — they need CREATE, not skip. Same source (FPL-GTR-282, Tables 5-4/4-3/14-1), same
 * caveats as the sibling scripts.
 */

import { prisma } from '../src/db/client.js';
import { fetchWoodProperties } from '../src/ai/woodProperties.js';

const CITES_API_BASE = 'https://api.speciesplus.net/api/v1/taxon_concepts';
const ATTRIBUTION =
  'Wood properties data from the Wood Handbook, USDA Forest Products Laboratory (public domain)';
const NONRESISTANT = 'Slightly or nonresistant';

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface NewSpecies {
  commonName: string;
  scientificName: string;
  family: string;
  originRegions: string;
  specificGravity: number;
  modulusOfRupture: number;
  modulusOfElasticity: number;
  compressionStrengthParallel: number;
  shrinkageRadial: number;
  shrinkageTangential: number;
  shrinkageVolumetric: number;
  decayResistance: string;
}

const NEW_SPECIES: NewSpecies[] = [
  {
    commonName: 'Bigtooth Aspen',
    scientificName: 'Populus grandidentata',
    family: 'Salicaceae',
    originRegions: 'Eastern North America',
    specificGravity: 0.39,
    modulusOfRupture: 9500,
    modulusOfElasticity: 1260000,
    compressionStrengthParallel: 4760,
    shrinkageRadial: 3.3,
    shrinkageTangential: 7.9,
    shrinkageVolumetric: 11.8,
    decayResistance: NONRESISTANT,
  },
  {
    commonName: 'Balsam Poplar',
    scientificName: 'Populus balsamifera',
    family: 'Salicaceae',
    originRegions: 'Northern North America',
    specificGravity: 0.37,
    modulusOfRupture: 10100,
    modulusOfElasticity: 1670000,
    compressionStrengthParallel: 5020,
    shrinkageRadial: 3.0,
    shrinkageTangential: 7.1,
    shrinkageVolumetric: 10.5,
    decayResistance: NONRESISTANT,
  },
  {
    commonName: 'Black Cottonwood',
    scientificName: 'Populus trichocarpa',
    family: 'Salicaceae',
    originRegions: 'Western North America',
    specificGravity: 0.35,
    modulusOfRupture: 8500,
    modulusOfElasticity: 1280000,
    compressionStrengthParallel: 4020,
    shrinkageRadial: 3.6,
    shrinkageTangential: 8.6,
    shrinkageVolumetric: 12.4,
    decayResistance: NONRESISTANT,
  },
  {
    commonName: 'Jack Pine',
    scientificName: 'Pinus banksiana',
    family: 'Pinaceae',
    originRegions: 'Northern North America',
    specificGravity: 0.42,
    modulusOfRupture: 11300,
    modulusOfElasticity: 1480000,
    compressionStrengthParallel: 5870,
    shrinkageRadial: 3.7,
    shrinkageTangential: 6.6,
    shrinkageVolumetric: 10.3,
    decayResistance: NONRESISTANT,
  },
  {
    commonName: 'Red Pine',
    scientificName: 'Pinus resinosa',
    family: 'Pinaceae',
    originRegions: 'Northeastern North America',
    specificGravity: 0.39,
    modulusOfRupture: 10100,
    modulusOfElasticity: 1380000,
    compressionStrengthParallel: 5500,
    shrinkageRadial: 3.8,
    shrinkageTangential: 7.2,
    shrinkageVolumetric: 11.3,
    decayResistance: NONRESISTANT,
  },
];

async function main() {
  let created = 0;

  for (const candidate of NEW_SPECIES) {
    const existing = await prisma.species.findUnique({
      where: { scientificName: candidate.scientificName },
    });
    if (existing) {
      console.log(`  ${candidate.scientificName} already exists — skipping (shouldn't happen).`);
      continue;
    }

    console.log(`Creating: ${candidate.commonName}`);
    const woodProperties = await fetchWoodProperties(
      candidate.commonName,
      candidate.scientificName,
    );
    const cites = await fetchCitesStatus(candidate.scientificName);

    await prisma.species.create({
      data: {
        commonName: candidate.commonName,
        scientificName: candidate.scientificName,
        family: candidate.family,
        originRegions: candidate.originRegions,
        jankaHardness: woodProperties ? Math.round(woodProperties.jankaHardness) : 0,
        density: candidate.specificGravity,
        grainType: woodProperties?.grainType ?? 'Unknown',
        texture: woodProperties?.texture ?? 'Unknown',
        poreStructure: 'Unknown',
        heartwoodColor: woodProperties?.heartwood ?? 'Unknown',
        sapwoodColor: woodProperties?.sapwood ?? 'Unknown',
        workabilityRating: woodProperties ? Math.round(woodProperties.workabilityRating) : 0,
        workabilityNotes: woodProperties?.workabilityNotes ?? '',
        commonUses: woodProperties?.commonUses ?? '',
        sustainabilityStatus: cites.sustainabilityStatus,
        citesListed: cites.citesListed,
        modulusOfRupture: candidate.modulusOfRupture,
        modulusOfElasticity: candidate.modulusOfElasticity,
        compressionStrengthParallel: candidate.compressionStrengthParallel,
        shrinkageRadial: candidate.shrinkageRadial,
        shrinkageTangential: candidate.shrinkageTangential,
        shrinkageVolumetric: candidate.shrinkageVolumetric,
        decayResistance: candidate.decayResistance,
        attribution: ATTRIBUTION,
      },
    });
    created += 1;
    await sleep(300);
  }

  console.log(`\nCreated ${created} species.`);
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
