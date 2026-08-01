import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../src/db/client.js';

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
const CITES_API_BASE = 'https://api.speciesplus.net/api/v1/taxon_concepts';
const USER_AGENT = 'WoodID-species-import/1.0 (https://github.com/woodid)';

// Wikidata taxon items don't chain up to a generic "tree" concept via parent-taxon —
// growth habit isn't part of the taxonomic hierarchy. Filtering by real timber-producing
// families (verified against the live SPARQL endpoint) is what actually returns tree species.
const TIMBER_FAMILIES: Record<string, string> = {
  Sapindaceae: 'Q27147',
  Fabaceae: 'Q44448',
  Rosaceae: 'Q46299',
  Lamiaceae: 'Q53476',
  Pinaceae: 'Q101680',
  Fagaceae: 'Q145977',
  Cupressaceae: 'Q146037',
  Betulaceae: 'Q156064',
  Moraceae: 'Q156579',
  Meliaceae: 'Q158979',
  Juglandaceae: 'Q216944',
};

const PER_FAMILY_LIMIT = 18;
const DENSITY_KG_M3_TO_G_CM3 = 1000;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface WikidataCandidate {
  commonName: string;
  scientificName: string;
  family: string;
  originRegions: string;
}

interface SparqlBinding {
  speciesLabel?: { value: string };
  scientificName?: { value: string };
  countryLabel?: { value: string };
}

interface SparqlResponse {
  results: { bindings: SparqlBinding[] };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildFamilyQuery(familyQid: string): string {
  // Bounded alternation (1-3 hops), not `P171*`: Wikidata's public endpoint times out on
  // unbounded transitive closure over a subtree this large, and Blazegraph (the engine behind
  // query.wikidata.org) doesn't support the `{1,4}` counted-repetition path syntax either.
  return `SELECT DISTINCT ?species ?speciesLabel ?scientificName ?countryLabel WHERE {
  BIND(wd:${familyQid} AS ?family)
  ?species (wdt:P171|wdt:P171/wdt:P171|wdt:P171/wdt:P171/wdt:P171) ?family .
  ?species wdt:P31 wd:Q16521 .
  ?species wdt:P105 wd:Q7432 .
  ?species wdt:P18 [] .
  ?species wdt:P225 ?scientificName .
  OPTIONAL { ?species wdt:P183 ?country }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}
LIMIT ${PER_FAMILY_LIMIT}`;
}

const MAX_WIKIDATA_RETRIES = 3;

async function fetchWikidataWithRetry(url: string, familyName: string): Promise<Response | null> {
  for (let attempt = 1; attempt <= MAX_WIKIDATA_RETRIES; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/sparql-results+json', 'User-Agent': USER_AGENT },
      });
    } catch (error) {
      console.warn(`  Wikidata query for ${familyName} failed to connect:`, error);
      return null;
    }

    if (response.ok) {
      return response;
    }

    // The public Wikidata endpoint rate-limits (429) and occasionally 5xxs under load;
    // both are worth a short backoff-and-retry before giving up on this family.
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_WIKIDATA_RETRIES) {
      console.warn(
        `  Wikidata query for ${familyName} got HTTP ${response.status}, retrying (${attempt}/${MAX_WIKIDATA_RETRIES})...`,
      );
      await sleep(2000 * attempt);
      continue;
    }

    console.warn(`  Wikidata query for ${familyName} failed: HTTP ${response.status}`);
    return null;
  }
  return null;
}

async function fetchFamilyCandidates(
  familyName: string,
  familyQid: string,
): Promise<WikidataCandidate[]> {
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(buildFamilyQuery(familyQid))}`;

  const response = await fetchWikidataWithRetry(url, familyName);
  if (!response) {
    return [];
  }

  const body = (await response.json()) as SparqlResponse;

  return body.results.bindings
    .map((row): WikidataCandidate => {
      const scientificName = row.scientificName?.value ?? '';
      const rawLabel = row.speciesLabel?.value ?? '';
      const isRawEntityId = /^Q\d+$/.test(rawLabel);
      return {
        commonName: isRawEntityId || !rawLabel ? scientificName : rawLabel,
        scientificName,
        family: familyName,
        originRegions: row.countryLabel?.value ?? 'Unknown',
      };
    })
    .filter((candidate) => candidate.scientificName.length > 0);
}

async function fetchWikidataCandidates(): Promise<WikidataCandidate[]> {
  const all: WikidataCandidate[] = [];

  for (const [familyName, familyQid] of Object.entries(TIMBER_FAMILIES)) {
    console.log(`Querying Wikidata for ${familyName}...`);
    const candidates = await fetchFamilyCandidates(familyName, familyQid);
    all.push(...candidates);
    await sleep(500);
  }

  const seen = new Set<string>();
  const deduped: WikidataCandidate[] = [];
  for (const candidate of all) {
    if (seen.has(candidate.scientificName)) {
      continue;
    }
    seen.add(candidate.scientificName);
    deduped.push(candidate);
  }
  return deduped;
}

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

interface WoodProperties {
  jankaHardness: number;
  density: number;
  grainType: string;
  texture: string;
  workabilityRating: number;
  workabilityNotes: string;
  commonUses: string;
  heartwood: string;
  sapwood: string;
}

function stripMarkdownCodeFence(text: string): string {
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text.trim());
  return fenceMatch ? fenceMatch[1] : text;
}

function isWoodProperties(value: unknown): value is WoodProperties {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.jankaHardness === 'number' &&
    typeof candidate.density === 'number' &&
    typeof candidate.grainType === 'string' &&
    typeof candidate.texture === 'string' &&
    typeof candidate.workabilityRating === 'number' &&
    typeof candidate.workabilityNotes === 'string' &&
    typeof candidate.commonUses === 'string' &&
    typeof candidate.heartwood === 'string' &&
    typeof candidate.sapwood === 'string'
  );
}

async function fetchWoodProperties(
  commonName: string,
  scientificName: string,
): Promise<WoodProperties | null> {
  const prompt =
    `For the wood species ${commonName} (${scientificName}), provide accurate wood ` +
    'properties as JSON only: jankaHardness (integer lbf), density (float kg/m3), grainType ' +
    '(one of: Straight, Interlocked, Wavy, Irregular), texture (one of: Fine, Medium, Coarse), ' +
    'workabilityRating (1-5 where 5 is easiest), workabilityNotes (one sentence), commonUses ' +
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

  if (!isWoodProperties(parsed)) {
    console.warn(`  Claude returned JSON in an unexpected shape for ${scientificName}.`);
    return null;
  }

  return parsed;
}

async function main() {
  console.log('Fetching candidate wood species from Wikidata...');
  const candidates = await fetchWikidataCandidates();
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
