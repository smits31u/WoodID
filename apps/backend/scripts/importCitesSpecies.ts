import { prisma } from '../src/db/client.js';
import {
  DENSITY_KG_M3_TO_G_CM3,
  fetchWoodProperties,
  mapAppendixToSustainability,
  sleep,
} from '../src/ai/woodProperties.js';

const CITES_API_BASE = 'https://api.speciesplus.net/api/v1/taxon_concepts';

// Families known for CITES-listed timber species (rosewoods, mahoganies, ipe/lapacho, etc.) —
// queried directly against Species+ rather than Wikidata so the CITES appendix/listing data
// comes straight from the authoritative source instead of a secondary lookup per species.
const CITES_FAMILIES = [
  'Meliaceae',
  'Dipterocarpaceae',
  'Fabaceae',
  'Cupressaceae',
  'Anacardiaceae',
  'Bignoniaceae',
];

interface CitesCommonName {
  name: string;
  language: string;
}

interface CitesDistribution {
  name: string;
}

interface CitesHigherTaxa {
  family?: string;
}

interface CitesTaxonConcept {
  full_name: string;
  rank: string;
  active: boolean;
  cites_listing?: string | null;
  higher_taxa?: CitesHigherTaxa;
  common_names?: CitesCommonName[];
  distributions?: CitesDistribution[];
}

interface CitesTaxonConceptsResponse {
  taxon_concepts?: CitesTaxonConcept[];
}

interface CitesSpeciesCandidate {
  commonName: string;
  scientificName: string;
  family: string;
  originRegions: string;
  sustainabilityStatus: string;
}

async function fetchFamilySpecies(familyName: string): Promise<CitesSpeciesCandidate[]> {
  const token = process.env.CITES_API_TOKEN;
  if (!token) {
    console.warn('CITES_API_TOKEN is not set; cannot query Species+.');
    return [];
  }

  const url = `${CITES_API_BASE}?name=${encodeURIComponent(familyName)}&with_descendants=true&per_page=500`;

  let response: Response;
  try {
    response = await fetch(url, { headers: { 'X-Authentication-Token': token } });
  } catch (error) {
    console.warn(`  CITES query for ${familyName} failed to connect:`, error);
    return [];
  }

  if (!response.ok) {
    console.warn(`  CITES query for ${familyName} failed: HTTP ${response.status}`);
    return [];
  }

  const body = (await response.json()) as CitesTaxonConceptsResponse;
  const concepts = body.taxon_concepts ?? [];

  return concepts
    .filter((concept) => concept.rank === 'SPECIES' && concept.active === true)
    .map((concept): CitesSpeciesCandidate => {
      const commonName = concept.common_names?.find((entry) => entry.language === 'EN')?.name;
      const primaryAppendix = concept.cites_listing?.split('/')[0]?.trim() ?? null;
      const originRegions = concept.distributions?.map((d) => d.name).join(', ');

      return {
        commonName: commonName ?? concept.full_name,
        scientificName: concept.full_name,
        family: concept.higher_taxa?.family ?? familyName,
        originRegions: originRegions && originRegions.length > 0 ? originRegions : 'Unknown',
        sustainabilityStatus: mapAppendixToSustainability(primaryAppendix),
      };
    });
}

async function fetchCitesCandidates(): Promise<CitesSpeciesCandidate[]> {
  const all: CitesSpeciesCandidate[] = [];

  for (const familyName of CITES_FAMILIES) {
    console.log(`Querying Species+ for ${familyName}...`);
    const candidates = await fetchFamilySpecies(familyName);
    all.push(...candidates);
    await sleep(500);
  }

  const seen = new Set<string>();
  const deduped: CitesSpeciesCandidate[] = [];
  for (const candidate of all) {
    if (seen.has(candidate.scientificName)) {
      continue;
    }
    seen.add(candidate.scientificName);
    deduped.push(candidate);
  }
  return deduped;
}

async function main() {
  console.log('Fetching CITES-listed wood species from Species+...');
  const candidates = await fetchCitesCandidates();
  console.log(`Found ${candidates.length} candidate species.\n`);

  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    console.log(`Processing ${i + 1} of ${candidates.length}: ${candidate.commonName}`);

    const woodProperties = await fetchWoodProperties(
      candidate.commonName,
      candidate.scientificName,
    );
    if (!woodProperties) {
      skipped += 1;
      continue;
    }

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
        sustainabilityStatus: candidate.sustainabilityStatus,
        citesListed: true,
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
        sustainabilityStatus: candidate.sustainabilityStatus,
        citesListed: true,
      },
    });
    imported += 1;

    await sleep(300);
  }

  console.log(`\nDone. Imported/updated ${imported} species, skipped ${skipped}.`);
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
