/**
 * Follow-up to importUSDAWoodHandbook.ts — imports Table 5-4 (species grown in Canada and
 * imported into the United States) and Table 5-5 (other imported species), plus the matching
 * shrinkage (Table 4-4) and decay resistance (Table 14-1, "Imported" column) data, from the
 * same USDA Forest Products Laboratory Wood Handbook (FPL-GTR-282). Same source, same chapters
 * (4, 5, 14), fetched and read directly from fpl.fs.usda.gov — see the header of
 * importUSDAWoodHandbook.ts for the general approach and caveats (in particular: no per-species
 * drying-difficulty rating exists in this source).
 *
 * Two scoping decisions specific to this pass:
 *
 * 1. Table 5-4 vs. Table 5-3 overlap — Table 5-4 (Canadian-grown) reports many of the same
 *    species already covered by Table 5-3 (US-grown) in the previous script (e.g. Black
 *    Spruce, Douglas-fir, Tamarack). These are two distinct, both-authoritative regional
 *    datasets for the same species, not a correction of one another. Rather than overwrite the
 *    already-applied Table 5-3 numbers with a different (not "more correct") regional dataset,
 *    UPDATE_RECORDS from Table 5-4 is limited to species not already enriched — i.e. rows the
 *    updater skips if `modulusOfRupture` is already set.
 *
 * 2. Table 5-5 "spp." entries — many trade names in Table 5-5 (e.g. "Bubinga (Guibourtia
 *    spp.)", "Purpleheart (Peltogyne spp.)") aren't given a single specific epithet. Where our
 *    DB doesn't already have an unambiguous single matching species for that genus, we don't
 *    fabricate one — those entries are skipped rather than guessed. Only exact single-binomial
 *    entries were transcribed.
 */

import { prisma } from '../src/db/client.js';
import { fetchWoodProperties } from '../src/ai/woodProperties.js';

const CITES_API_BASE = 'https://api.speciesplus.net/api/v1/taxon_concepts';
const ATTRIBUTION =
  'Wood properties data from the Wood Handbook, USDA Forest Products Laboratory (public domain)';

const VERY_RESISTANT = 'Very resistant';
const RESISTANT = 'Resistant';
const MODERATELY_RESISTANT = 'Moderately resistant';
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

interface USDAFields {
  specificGravity: number;
  modulusOfRupture: number | null;
  modulusOfElasticity: number | null;
  compressionStrengthParallel: number;
  jankaHardness: number | null;
  shrinkageRadial: number | null;
  shrinkageTangential: number | null;
  shrinkageVolumetric: number | null;
  decayResistance: string | null;
}

// ---- Table 5-4 (Canadian-grown) — only species NOT already enriched by Table 5-3 ----
interface UpdateRecord extends USDAFields {
  scientificName: string;
}

const UPDATE_RECORDS: UpdateRecord[] = [
  {
    scientificName: 'Populus tremuloides',
    specificGravity: 0.37,
    modulusOfRupture: 9800,
    modulusOfElasticity: 1630000,
    compressionStrengthParallel: 5260,
    jankaHardness: null,
    shrinkageRadial: 3.5,
    shrinkageTangential: 6.7,
    shrinkageVolumetric: 11.5,
    decayResistance: NONRESISTANT,
  },
  {
    scientificName: 'Populus grandidentata',
    specificGravity: 0.39,
    modulusOfRupture: 9500,
    modulusOfElasticity: 1260000,
    compressionStrengthParallel: 4760,
    jankaHardness: null,
    shrinkageRadial: 3.3,
    shrinkageTangential: 7.9,
    shrinkageVolumetric: 11.8,
    decayResistance: NONRESISTANT,
  },
  {
    scientificName: 'Populus balsamifera',
    specificGravity: 0.37,
    modulusOfRupture: 10100,
    modulusOfElasticity: 1670000,
    compressionStrengthParallel: 5020,
    jankaHardness: null,
    shrinkageRadial: 3.0,
    shrinkageTangential: 7.1,
    shrinkageVolumetric: 10.5,
    decayResistance: NONRESISTANT,
  },
  {
    scientificName: 'Populus trichocarpa',
    specificGravity: 0.35,
    modulusOfRupture: 8500,
    modulusOfElasticity: 1280000,
    compressionStrengthParallel: 4020,
    jankaHardness: null,
    shrinkageRadial: 3.6,
    shrinkageTangential: 8.6,
    shrinkageVolumetric: 12.4,
    decayResistance: NONRESISTANT,
  },
  {
    scientificName: 'Pinus banksiana',
    specificGravity: 0.42,
    modulusOfRupture: 11300,
    modulusOfElasticity: 1480000,
    compressionStrengthParallel: 5870,
    jankaHardness: null,
    shrinkageRadial: 3.7,
    shrinkageTangential: 6.6,
    shrinkageVolumetric: 10.3,
    decayResistance: NONRESISTANT,
  },
  {
    scientificName: 'Pinus resinosa',
    specificGravity: 0.39,
    modulusOfRupture: 10100,
    modulusOfElasticity: 1380000,
    compressionStrengthParallel: 5500,
    jankaHardness: null,
    shrinkageRadial: 3.8,
    shrinkageTangential: 7.2,
    shrinkageVolumetric: 11.3,
    decayResistance: NONRESISTANT,
  },
];

// ---- Table 5-5 (other imported species) — exact single-binomial entries only ----
interface NewSpecies extends USDAFields {
  commonName: string;
  scientificName: string;
  family: string;
  originRegions: string;
}

const NEW_SPECIES: NewSpecies[] = [
  {
    commonName: 'Afrormosia',
    scientificName: 'Pericopsis elata',
    family: 'Fabaceae',
    originRegions: 'West and Central Africa',
    specificGravity: 0.61,
    modulusOfRupture: 18400,
    modulusOfElasticity: 1940000,
    compressionStrengthParallel: 9940,
    jankaHardness: 1560,
    shrinkageRadial: 3.0,
    shrinkageTangential: 6.4,
    shrinkageVolumetric: 10.7,
    decayResistance: RESISTANT,
  },
  {
    commonName: 'Andiroba',
    scientificName: 'Carapa guianensis',
    family: 'Meliaceae',
    originRegions: 'Tropical America',
    specificGravity: 0.54,
    modulusOfRupture: 15500,
    modulusOfElasticity: 2000000,
    compressionStrengthParallel: 8120,
    jankaHardness: 1130,
    shrinkageRadial: 3.1,
    shrinkageTangential: 7.6,
    shrinkageVolumetric: 10.4,
    decayResistance: null,
  },
  {
    commonName: 'Angelin',
    scientificName: 'Andira inermis',
    family: 'Fabaceae',
    originRegions: 'Tropical America',
    specificGravity: 0.65,
    modulusOfRupture: 18000,
    modulusOfElasticity: 2490000,
    compressionStrengthParallel: 9200,
    jankaHardness: 1750,
    shrinkageRadial: 4.6,
    shrinkageTangential: 9.8,
    shrinkageVolumetric: 12.5,
    decayResistance: null,
  },
  {
    commonName: 'Angelique',
    scientificName: 'Dicorynia guianensis',
    family: 'Fabaceae',
    originRegions: 'Tropical America (Guiana Shield)',
    specificGravity: 0.6,
    modulusOfRupture: 17400,
    modulusOfElasticity: 2190000,
    compressionStrengthParallel: 8770,
    jankaHardness: 1290,
    shrinkageRadial: 5.2,
    shrinkageTangential: 8.8,
    shrinkageVolumetric: 14.0,
    decayResistance: RESISTANT,
  },
  {
    commonName: 'Avodire',
    scientificName: 'Turraeanthus africanus',
    family: 'Meliaceae',
    originRegions: 'West Africa',
    specificGravity: 0.48,
    modulusOfRupture: 12700,
    modulusOfElasticity: 1490000,
    compressionStrengthParallel: 7150,
    jankaHardness: 1080,
    shrinkageRadial: 4.6,
    shrinkageTangential: 6.7,
    shrinkageVolumetric: 12.0,
    decayResistance: MODERATELY_RESISTANT,
  },
  {
    commonName: 'Azobe',
    scientificName: 'Lophira alata',
    family: 'Ochnaceae',
    originRegions: 'West and Central Africa',
    specificGravity: 0.87,
    modulusOfRupture: 24500,
    modulusOfElasticity: 2470000,
    compressionStrengthParallel: 12600,
    jankaHardness: 3350,
    shrinkageRadial: 8.4,
    shrinkageTangential: 11.0,
    shrinkageVolumetric: 17.0,
    decayResistance: null,
  },
  {
    commonName: 'Balsa',
    scientificName: 'Ochroma pyramidale',
    family: 'Malvaceae',
    originRegions: 'Tropical America',
    specificGravity: 0.16,
    modulusOfRupture: 3140,
    modulusOfElasticity: 490000,
    compressionStrengthParallel: 2160,
    jankaHardness: null,
    shrinkageRadial: 3.0,
    shrinkageTangential: 7.6,
    shrinkageVolumetric: 10.8,
    decayResistance: NONRESISTANT,
  },
  {
    commonName: 'Cativo',
    scientificName: 'Prioria copaifera',
    family: 'Fabaceae',
    originRegions: 'Central America',
    specificGravity: 0.4,
    modulusOfRupture: 8600,
    modulusOfElasticity: 1110000,
    compressionStrengthParallel: 4290,
    jankaHardness: 630,
    shrinkageRadial: 2.4,
    shrinkageTangential: 5.3,
    shrinkageVolumetric: 8.9,
    decayResistance: NONRESISTANT,
  },
  {
    commonName: 'Ceiba',
    scientificName: 'Ceiba pentandra',
    family: 'Malvaceae',
    originRegions: 'Tropical America',
    specificGravity: 0.25,
    modulusOfRupture: 4300,
    modulusOfElasticity: 540000,
    compressionStrengthParallel: 2380,
    jankaHardness: 240,
    shrinkageRadial: 2.1,
    shrinkageTangential: 4.1,
    shrinkageVolumetric: 10.4,
    decayResistance: NONRESISTANT,
  },
  {
    commonName: 'Courbaril',
    scientificName: 'Hymenaea courbaril',
    family: 'Fabaceae',
    originRegions: 'Tropical America',
    specificGravity: 0.71,
    modulusOfRupture: 19400,
    modulusOfElasticity: 2160000,
    compressionStrengthParallel: 9510,
    jankaHardness: 2350,
    shrinkageRadial: 4.5,
    shrinkageTangential: 8.5,
    shrinkageVolumetric: 12.7,
    decayResistance: RESISTANT,
  },
  {
    commonName: 'Mexican Cypress',
    scientificName: 'Cupressus lusitanica',
    family: 'Cupressaceae',
    originRegions: 'Central America and Mexico',
    specificGravity: 0.39,
    modulusOfRupture: 10300,
    modulusOfElasticity: 1020000,
    compressionStrengthParallel: 5380,
    jankaHardness: 460,
    shrinkageRadial: null,
    shrinkageTangential: null,
    shrinkageVolumetric: null,
    decayResistance: null,
  },
  {
    commonName: 'Degame',
    scientificName: 'Calycophyllum candidissimum',
    family: 'Rubiaceae',
    originRegions: 'Tropical America',
    specificGravity: 0.67,
    modulusOfRupture: 22300,
    modulusOfElasticity: 2270000,
    compressionStrengthParallel: 9670,
    jankaHardness: 1940,
    shrinkageRadial: 4.8,
    shrinkageTangential: 8.6,
    shrinkageVolumetric: 13.2,
    decayResistance: null,
  },
  {
    commonName: 'Determa',
    scientificName: 'Ocotea rubra',
    family: 'Lauraceae',
    originRegions: 'Tropical America',
    specificGravity: 0.52,
    modulusOfRupture: 10500,
    modulusOfElasticity: 1820000,
    compressionStrengthParallel: 5800,
    jankaHardness: 660,
    shrinkageRadial: 3.7,
    shrinkageTangential: 7.6,
    shrinkageVolumetric: 10.4,
    decayResistance: RESISTANT,
  },
  {
    commonName: 'Ekop',
    scientificName: 'Tetraberlinia tubmaniana',
    family: 'Fabaceae',
    originRegions: 'West Africa',
    specificGravity: 0.6,
    modulusOfRupture: 16700,
    modulusOfElasticity: 2210000,
    compressionStrengthParallel: 9010,
    jankaHardness: null,
    shrinkageRadial: 5.6,
    shrinkageTangential: 10.2,
    shrinkageVolumetric: 15.8,
    decayResistance: MODERATELY_RESISTANT,
  },
  {
    commonName: 'Gonçalo Alves',
    scientificName: 'Astronium graveolens',
    family: 'Anacardiaceae',
    originRegions: 'Tropical America',
    specificGravity: 0.84,
    modulusOfRupture: 16600,
    modulusOfElasticity: 2230000,
    compressionStrengthParallel: 10320,
    jankaHardness: 2160,
    shrinkageRadial: 4.0,
    shrinkageTangential: 7.6,
    shrinkageVolumetric: 10.0,
    decayResistance: null,
  },
  {
    commonName: 'Greenheart',
    scientificName: 'Chlorocardium rodiei',
    family: 'Lauraceae',
    originRegions: 'Tropical America (Guyana)',
    specificGravity: 0.8,
    modulusOfRupture: 24900,
    modulusOfElasticity: 3250000,
    compressionStrengthParallel: 12510,
    jankaHardness: 2350,
    shrinkageRadial: 8.8,
    shrinkageTangential: 9.6,
    shrinkageVolumetric: 17.1,
    decayResistance: VERY_RESISTANT,
  },
  {
    commonName: 'Hura',
    scientificName: 'Hura crepitans',
    family: 'Euphorbiaceae',
    originRegions: 'Tropical America',
    specificGravity: 0.38,
    modulusOfRupture: 8700,
    modulusOfElasticity: 1170000,
    compressionStrengthParallel: 4800,
    jankaHardness: 550,
    shrinkageRadial: 2.7,
    shrinkageTangential: 4.5,
    shrinkageVolumetric: 7.3,
    decayResistance: null,
  },
  {
    commonName: 'Ilomba',
    scientificName: 'Pycnanthus angolensis',
    family: 'Myristicaceae',
    originRegions: 'West and Central Africa',
    specificGravity: 0.4,
    modulusOfRupture: 9900,
    modulusOfElasticity: 1590000,
    compressionStrengthParallel: 5550,
    jankaHardness: 610,
    shrinkageRadial: 4.6,
    shrinkageTangential: 8.4,
    shrinkageVolumetric: 12.8,
    decayResistance: null,
  },
  {
    commonName: 'Ipe (lapacho)',
    scientificName: 'Tabebuia serratifolia',
    family: 'Bignoniaceae',
    originRegions: 'Tropical America',
    specificGravity: 0.92,
    modulusOfRupture: 25400,
    modulusOfElasticity: 3140000,
    compressionStrengthParallel: 13010,
    jankaHardness: 3680,
    shrinkageRadial: 6.6,
    shrinkageTangential: 8.0,
    shrinkageVolumetric: 13.2,
    decayResistance: VERY_RESISTANT,
  },
  {
    commonName: 'Iroko',
    scientificName: 'Milicia excelsa',
    family: 'Moraceae',
    originRegions: 'Tropical Africa',
    specificGravity: 0.54,
    modulusOfRupture: 12400,
    modulusOfElasticity: 1460000,
    compressionStrengthParallel: 7590,
    jankaHardness: 1260,
    shrinkageRadial: 2.8,
    shrinkageTangential: 3.8,
    shrinkageVolumetric: 8.8,
    decayResistance: RESISTANT,
  },
  {
    commonName: 'Jarrah',
    scientificName: 'Eucalyptus marginata',
    family: 'Myrtaceae',
    originRegions: 'Southwestern Australia',
    specificGravity: 0.67,
    modulusOfRupture: 16200,
    modulusOfElasticity: 1880000,
    compressionStrengthParallel: 8870,
    jankaHardness: 1910,
    shrinkageRadial: 7.7,
    shrinkageTangential: 11.0,
    shrinkageVolumetric: 18.7,
    decayResistance: VERY_RESISTANT,
  },
  {
    commonName: 'Jelutong',
    scientificName: 'Dyera costulata',
    family: 'Apocynaceae',
    originRegions: 'Southeast Asia',
    specificGravity: 0.36,
    modulusOfRupture: 7300,
    modulusOfElasticity: 1180000,
    compressionStrengthParallel: 3920,
    jankaHardness: 390,
    shrinkageRadial: 2.3,
    shrinkageTangential: 5.5,
    shrinkageVolumetric: 7.8,
    decayResistance: NONRESISTANT,
  },
  {
    commonName: 'Kapur',
    scientificName: 'Dryobalanops aromatica',
    family: 'Dipterocarpaceae',
    originRegions: 'Southeast Asia',
    specificGravity: 0.64,
    modulusOfRupture: 18300,
    modulusOfElasticity: 1880000,
    compressionStrengthParallel: 10090,
    jankaHardness: 1230,
    shrinkageRadial: 4.6,
    shrinkageTangential: 10.2,
    shrinkageVolumetric: 14.8,
    decayResistance: null,
  },
  {
    commonName: 'Karri',
    scientificName: 'Eucalyptus diversicolor',
    family: 'Myrtaceae',
    originRegions: 'Southwestern Australia',
    specificGravity: 0.82,
    modulusOfRupture: 20160,
    modulusOfElasticity: 2600000,
    compressionStrengthParallel: 10800,
    jankaHardness: 2040,
    shrinkageRadial: 7.8,
    shrinkageTangential: 12.4,
    shrinkageVolumetric: 20.2,
    decayResistance: RESISTANT,
  },
  {
    commonName: 'Kempas',
    scientificName: 'Koompassia malaccensis',
    family: 'Fabaceae',
    originRegions: 'Southeast Asia',
    specificGravity: 0.71,
    modulusOfRupture: 17700,
    modulusOfElasticity: 2690000,
    compressionStrengthParallel: 9520,
    jankaHardness: 1710,
    shrinkageRadial: 6.0,
    shrinkageTangential: 7.4,
    shrinkageVolumetric: 14.5,
    decayResistance: null,
  },
  {
    commonName: 'Keruing',
    scientificName: 'Dipterocarpus grandiflorus',
    family: 'Dipterocarpaceae',
    originRegions: 'Southeast Asia',
    specificGravity: 0.69,
    modulusOfRupture: 19900,
    modulusOfElasticity: 2070000,
    compressionStrengthParallel: 10500,
    jankaHardness: 1270,
    shrinkageRadial: 5.2,
    shrinkageTangential: 10.9,
    shrinkageVolumetric: 16.1,
    decayResistance: MODERATELY_RESISTANT,
  },
  {
    commonName: 'Lignumvitae',
    scientificName: 'Guaiacum officinale',
    family: 'Zygophyllaceae',
    originRegions: 'Tropical America and Caribbean',
    specificGravity: 1.05,
    modulusOfRupture: null,
    modulusOfElasticity: null,
    compressionStrengthParallel: 11400,
    jankaHardness: 4500,
    shrinkageRadial: null,
    shrinkageTangential: null,
    shrinkageVolumetric: null,
    decayResistance: VERY_RESISTANT,
  },
  {
    commonName: 'Limba',
    scientificName: 'Terminalia superba',
    family: 'Combretaceae',
    originRegions: 'West and Central Africa',
    specificGravity: 0.38,
    modulusOfRupture: 8800,
    modulusOfElasticity: 1010000,
    compressionStrengthParallel: 4730,
    jankaHardness: 490,
    shrinkageRadial: 4.5,
    shrinkageTangential: 6.2,
    shrinkageVolumetric: 10.8,
    decayResistance: NONRESISTANT,
  },
  {
    commonName: 'Macawood',
    scientificName: 'Platymiscium pinnatum',
    family: 'Fabaceae',
    originRegions: 'Tropical America',
    specificGravity: 0.94,
    modulusOfRupture: 27600,
    modulusOfElasticity: 3200000,
    compressionStrengthParallel: 16100,
    jankaHardness: 3150,
    shrinkageRadial: 2.7,
    shrinkageTangential: 3.5,
    shrinkageVolumetric: 6.5,
    decayResistance: null,
  },
  {
    commonName: 'African Mahogany',
    scientificName: 'Khaya ivorensis',
    family: 'Meliaceae',
    originRegions: 'West Africa',
    specificGravity: 0.42,
    modulusOfRupture: 10700,
    modulusOfElasticity: 1400000,
    compressionStrengthParallel: 6460,
    jankaHardness: 830,
    shrinkageRadial: 2.5,
    shrinkageTangential: 4.5,
    shrinkageVolumetric: 8.8,
    decayResistance: RESISTANT,
  },
  {
    commonName: 'Manbarklak',
    scientificName: 'Eschweilera odora',
    family: 'Lecythidaceae',
    originRegions: 'Tropical America',
    specificGravity: 0.87,
    modulusOfRupture: 26500,
    modulusOfElasticity: 3140000,
    compressionStrengthParallel: 11210,
    jankaHardness: 3480,
    shrinkageRadial: 5.8,
    shrinkageTangential: 10.3,
    shrinkageVolumetric: 15.9,
    decayResistance: null,
  },
  {
    commonName: 'Manni',
    scientificName: 'Symphonia globulifera',
    family: 'Clusiaceae',
    originRegions: 'Tropical America and West Africa',
    specificGravity: 0.58,
    modulusOfRupture: 16900,
    modulusOfElasticity: 2460000,
    compressionStrengthParallel: 8820,
    jankaHardness: 1120,
    shrinkageRadial: 5.7,
    shrinkageTangential: 9.7,
    shrinkageVolumetric: 15.6,
    decayResistance: RESISTANT,
  },
  {
    commonName: 'Mersawa',
    scientificName: 'Anisoptera thurifera',
    family: 'Dipterocarpaceae',
    originRegions: 'Southeast Asia',
    specificGravity: 0.52,
    modulusOfRupture: 13800,
    modulusOfElasticity: 2280000,
    compressionStrengthParallel: 7370,
    jankaHardness: 1290,
    shrinkageRadial: 4.0,
    shrinkageTangential: 9.0,
    shrinkageVolumetric: 14.6,
    decayResistance: MODERATELY_RESISTANT,
  },
  {
    commonName: 'Mora',
    scientificName: 'Mora excelsa',
    family: 'Fabaceae',
    originRegions: 'Tropical America (Guiana Shield)',
    specificGravity: 0.78,
    modulusOfRupture: 22100,
    modulusOfElasticity: 2960000,
    compressionStrengthParallel: 11840,
    jankaHardness: 2300,
    shrinkageRadial: 6.9,
    shrinkageTangential: 9.8,
    shrinkageVolumetric: 18.8,
    decayResistance: null,
  },
  {
    commonName: 'Obeche',
    scientificName: 'Triplochiton scleroxylon',
    family: 'Malvaceae',
    originRegions: 'West Africa',
    specificGravity: 0.3,
    modulusOfRupture: 7400,
    modulusOfElasticity: 860000,
    compressionStrengthParallel: 3930,
    jankaHardness: 430,
    shrinkageRadial: 3.0,
    shrinkageTangential: 5.4,
    shrinkageVolumetric: 9.2,
    decayResistance: NONRESISTANT,
  },
  {
    commonName: 'Okoume',
    scientificName: 'Aucoumea klaineana',
    family: 'Burseraceae',
    originRegions: 'West Africa (Gabon)',
    specificGravity: 0.33,
    modulusOfRupture: 7400,
    modulusOfElasticity: 1140000,
    compressionStrengthParallel: 3970,
    jankaHardness: 380,
    shrinkageRadial: 4.1,
    shrinkageTangential: 6.1,
    shrinkageVolumetric: 11.3,
    decayResistance: NONRESISTANT,
  },
  {
    commonName: 'Opepe',
    scientificName: 'Nauclea diderrichii',
    family: 'Rubiaceae',
    originRegions: 'West and Central Africa',
    specificGravity: 0.63,
    modulusOfRupture: 17400,
    modulusOfElasticity: 1940000,
    compressionStrengthParallel: 10400,
    jankaHardness: 1630,
    shrinkageRadial: 4.5,
    shrinkageTangential: 8.4,
    shrinkageVolumetric: 12.6,
    decayResistance: null,
  },
  {
    commonName: 'Para-angelim',
    scientificName: 'Hymenolobium excelsum',
    family: 'Fabaceae',
    originRegions: 'Tropical America (Amazon)',
    specificGravity: 0.63,
    modulusOfRupture: 17600,
    modulusOfElasticity: 2050000,
    compressionStrengthParallel: 8990,
    jankaHardness: 1720,
    shrinkageRadial: 4.4,
    shrinkageTangential: 7.1,
    shrinkageVolumetric: 10.2,
    decayResistance: null,
  },
  {
    commonName: 'Parana Pine',
    scientificName: 'Araucaria angustifolia',
    family: 'Araucariaceae',
    originRegions: 'Southern Brazil',
    specificGravity: 0.46,
    modulusOfRupture: 13500,
    modulusOfElasticity: 1610000,
    compressionStrengthParallel: 7660,
    jankaHardness: 780,
    shrinkageRadial: 4.0,
    shrinkageTangential: 7.9,
    shrinkageVolumetric: 11.6,
    decayResistance: null,
  },
  {
    commonName: 'Pau Marfim',
    scientificName: 'Balfourodendron riedelianum',
    family: 'Rutaceae',
    originRegions: 'South America (Brazil, Argentina)',
    specificGravity: 0.73,
    modulusOfRupture: 18900,
    modulusOfElasticity: null,
    compressionStrengthParallel: 8190,
    jankaHardness: null,
    shrinkageRadial: 4.6,
    shrinkageTangential: 8.8,
    shrinkageVolumetric: 13.4,
    decayResistance: null,
  },
  {
    commonName: 'Peroba de Campos',
    scientificName: 'Paratecoma peroba',
    family: 'Bignoniaceae',
    originRegions: 'Southeastern Brazil',
    specificGravity: 0.62,
    modulusOfRupture: 15400,
    modulusOfElasticity: 1770000,
    compressionStrengthParallel: 8880,
    jankaHardness: 1600,
    shrinkageRadial: 3.8,
    shrinkageTangential: 6.6,
    shrinkageVolumetric: 10.5,
    decayResistance: null,
  },
  {
    commonName: 'Peroba Rosa',
    scientificName: 'Aspidosperma polyneuron',
    family: 'Apocynaceae',
    originRegions: 'South America (Brazil)',
    specificGravity: 0.66,
    modulusOfRupture: 12100,
    modulusOfElasticity: 1530000,
    compressionStrengthParallel: 7920,
    jankaHardness: 1730,
    shrinkageRadial: 3.8,
    shrinkageTangential: 6.4,
    shrinkageVolumetric: 11.6,
    decayResistance: null,
  },
  {
    commonName: 'Pilon',
    scientificName: 'Hyeronima alchorneoides',
    family: 'Phyllanthaceae',
    originRegions: 'Tropical America',
    specificGravity: 0.65,
    modulusOfRupture: 18200,
    modulusOfElasticity: 2270000,
    compressionStrengthParallel: 9620,
    jankaHardness: 1700,
    shrinkageRadial: 5.4,
    shrinkageTangential: 11.7,
    shrinkageVolumetric: 17.0,
    decayResistance: null,
  },
  {
    commonName: 'Caribbean Pine',
    scientificName: 'Pinus caribaea',
    family: 'Pinaceae',
    originRegions: 'Central America and Caribbean',
    specificGravity: 0.68,
    modulusOfRupture: 16700,
    modulusOfElasticity: 2240000,
    compressionStrengthParallel: 8540,
    jankaHardness: 1240,
    shrinkageRadial: 6.3,
    shrinkageTangential: 7.8,
    shrinkageVolumetric: 12.9,
    decayResistance: null,
  },
  {
    commonName: 'Ocote Pine',
    scientificName: 'Pinus oocarpa',
    family: 'Pinaceae',
    originRegions: 'Mexico and Central America',
    specificGravity: 0.55,
    modulusOfRupture: 14900,
    modulusOfElasticity: 2250000,
    compressionStrengthParallel: 7680,
    jankaHardness: 910,
    shrinkageRadial: null,
    shrinkageTangential: null,
    shrinkageVolumetric: null,
    decayResistance: null,
  },
  {
    commonName: 'Radiata Pine',
    scientificName: 'Pinus radiata',
    family: 'Pinaceae',
    originRegions: 'Native to California; widely plantation-grown in Australia/New Zealand/Chile',
    specificGravity: 0.42,
    modulusOfRupture: 11700,
    modulusOfElasticity: 1480000,
    compressionStrengthParallel: 6080,
    jankaHardness: 750,
    shrinkageRadial: null,
    shrinkageTangential: null,
    shrinkageVolumetric: null,
    decayResistance: null,
  },
  {
    commonName: 'Piquia',
    scientificName: 'Caryocar villosum',
    family: 'Caryocaraceae',
    originRegions: 'Tropical America (Amazon)',
    specificGravity: 0.72,
    modulusOfRupture: 17000,
    modulusOfElasticity: 2160000,
    compressionStrengthParallel: 8410,
    jankaHardness: 1720,
    shrinkageRadial: 5.0,
    shrinkageTangential: 8.0,
    shrinkageVolumetric: 13.0,
    decayResistance: null,
  },
  {
    commonName: 'Primavera',
    scientificName: 'Tabebuia donnell-smithii',
    family: 'Bignoniaceae',
    originRegions: 'Central America',
    specificGravity: 0.4,
    modulusOfRupture: 9500,
    modulusOfElasticity: 1040000,
    compressionStrengthParallel: 5600,
    jankaHardness: 660,
    shrinkageRadial: 3.1,
    shrinkageTangential: 5.1,
    shrinkageVolumetric: 9.1,
    decayResistance: null,
  },
  {
    commonName: 'Purpleheart',
    scientificName: 'Peltogyne paniculata',
    family: 'Fabaceae',
    originRegions: 'Tropical America',
    specificGravity: 0.67,
    modulusOfRupture: 19200,
    modulusOfElasticity: 2270000,
    compressionStrengthParallel: 10320,
    jankaHardness: 1860,
    shrinkageRadial: 3.2,
    shrinkageTangential: 6.1,
    shrinkageVolumetric: 9.9,
    decayResistance: null,
  },
  {
    commonName: 'Ramin',
    scientificName: 'Gonystylus bancanus',
    family: 'Thymelaeaceae',
    originRegions: 'Southeast Asia',
    specificGravity: 0.52,
    modulusOfRupture: 18500,
    modulusOfElasticity: 2170000,
    compressionStrengthParallel: 10080,
    jankaHardness: 1300,
    shrinkageRadial: 4.3,
    shrinkageTangential: 8.7,
    shrinkageVolumetric: 13.4,
    decayResistance: NONRESISTANT,
  },
  {
    commonName: 'Brazilian Rosewood',
    scientificName: 'Dalbergia nigra',
    family: 'Fabaceae',
    originRegions: 'Eastern Brazil',
    specificGravity: 0.8,
    modulusOfRupture: 19000,
    modulusOfElasticity: 1880000,
    compressionStrengthParallel: 9600,
    jankaHardness: 2720,
    shrinkageRadial: 2.9,
    shrinkageTangential: 4.6,
    shrinkageVolumetric: 8.5,
    decayResistance: null,
  },
  {
    commonName: 'Indian Rosewood',
    scientificName: 'Dalbergia latifolia',
    family: 'Fabaceae',
    originRegions: 'India',
    specificGravity: 0.75,
    modulusOfRupture: 16900,
    modulusOfElasticity: 1780000,
    compressionStrengthParallel: 9220,
    jankaHardness: 3170,
    shrinkageRadial: 2.7,
    shrinkageTangential: 5.8,
    shrinkageVolumetric: 8.5,
    decayResistance: null,
  },
  {
    commonName: 'Sande',
    scientificName: 'Brosimum utile',
    family: 'Moraceae',
    originRegions: 'Tropical America',
    specificGravity: 0.49,
    modulusOfRupture: 14300,
    modulusOfElasticity: 2390000,
    compressionStrengthParallel: 8220,
    jankaHardness: 900,
    shrinkageRadial: 4.6,
    shrinkageTangential: 8.0,
    shrinkageVolumetric: 13.6,
    decayResistance: null,
  },
  {
    commonName: 'Santa Maria',
    scientificName: 'Calophyllum brasiliense',
    family: 'Calophyllaceae',
    originRegions: 'Tropical America',
    specificGravity: 0.52,
    modulusOfRupture: 14600,
    modulusOfElasticity: 1830000,
    compressionStrengthParallel: 6910,
    jankaHardness: 1150,
    shrinkageRadial: null,
    shrinkageTangential: null,
    shrinkageVolumetric: null,
    decayResistance: null,
  },
  {
    commonName: 'Sapele',
    scientificName: 'Entandrophragma cylindricum',
    family: 'Meliaceae',
    originRegions: 'West and Central Africa',
    specificGravity: 0.55,
    modulusOfRupture: 15300,
    modulusOfElasticity: 1820000,
    compressionStrengthParallel: 8160,
    jankaHardness: 1510,
    shrinkageRadial: 4.6,
    shrinkageTangential: 7.4,
    shrinkageVolumetric: 14.0,
    decayResistance: null,
  },
  {
    commonName: 'Sepetir',
    scientificName: 'Pseudosindora palustris',
    family: 'Fabaceae',
    originRegions: 'Southeast Asia',
    specificGravity: 0.56,
    modulusOfRupture: 17200,
    modulusOfElasticity: 1970000,
    compressionStrengthParallel: 8880,
    jankaHardness: 1410,
    shrinkageRadial: 3.7,
    shrinkageTangential: 7.0,
    shrinkageVolumetric: 10.5,
    decayResistance: null,
  },
  {
    commonName: 'Dark Red Meranti',
    scientificName: 'Shorea negrosensis',
    family: 'Dipterocarpaceae',
    originRegions: 'Southeast Asia',
    specificGravity: 0.46,
    modulusOfRupture: 12700,
    modulusOfElasticity: 1770000,
    compressionStrengthParallel: 7360,
    jankaHardness: 780,
    shrinkageRadial: null,
    shrinkageTangential: null,
    shrinkageVolumetric: null,
    decayResistance: MODERATELY_RESISTANT,
  },
  {
    commonName: 'White Meranti',
    scientificName: 'Shorea polysperma',
    family: 'Dipterocarpaceae',
    originRegions: 'Southeast Asia',
    specificGravity: 0.55,
    modulusOfRupture: 12400,
    modulusOfElasticity: 1490000,
    compressionStrengthParallel: 6350,
    jankaHardness: 1140,
    shrinkageRadial: null,
    shrinkageTangential: null,
    shrinkageVolumetric: null,
    decayResistance: NONRESISTANT,
  },
  {
    commonName: 'Spanish Cedar',
    scientificName: 'Cedrela odorata',
    family: 'Meliaceae',
    originRegions: 'Tropical America',
    specificGravity: 0.41,
    modulusOfRupture: 11500,
    modulusOfElasticity: 1440000,
    compressionStrengthParallel: 6210,
    jankaHardness: 600,
    shrinkageRadial: 4.2,
    shrinkageTangential: 6.3,
    shrinkageVolumetric: 10.3,
    decayResistance: RESISTANT,
  },
  {
    commonName: 'Sucupira',
    scientificName: 'Diplotropis purpurea',
    family: 'Fabaceae',
    originRegions: 'Tropical America',
    specificGravity: 0.78,
    modulusOfRupture: 20600,
    modulusOfElasticity: 2870000,
    compressionStrengthParallel: 12140,
    jankaHardness: 2140,
    shrinkageRadial: 4.6,
    shrinkageTangential: 7.0,
    shrinkageVolumetric: 11.8,
    decayResistance: RESISTANT,
  },
  {
    commonName: 'Teak',
    scientificName: 'Tectona grandis',
    family: 'Lamiaceae',
    originRegions: 'South and Southeast Asia',
    specificGravity: 0.55,
    modulusOfRupture: 14600,
    modulusOfElasticity: 1550000,
    compressionStrengthParallel: 8410,
    jankaHardness: 1000,
    shrinkageRadial: 2.5,
    shrinkageTangential: 5.8,
    shrinkageVolumetric: 7.0,
    decayResistance: RESISTANT,
  },
  {
    commonName: 'Tornillo',
    scientificName: 'Cedrelinga cateniformis',
    family: 'Fabaceae',
    originRegions: 'Tropical America (Amazon)',
    specificGravity: 0.45,
    modulusOfRupture: 8400,
    modulusOfElasticity: null,
    compressionStrengthParallel: 4100,
    jankaHardness: 870,
    shrinkageRadial: null,
    shrinkageTangential: null,
    shrinkageVolumetric: null,
    decayResistance: MODERATELY_RESISTANT,
  },
  {
    commonName: 'Wallaba',
    scientificName: 'Eperua falcata',
    family: 'Fabaceae',
    originRegions: 'Tropical America (Guiana Shield)',
    specificGravity: 0.78,
    modulusOfRupture: 19100,
    modulusOfElasticity: 2280000,
    compressionStrengthParallel: 10760,
    jankaHardness: 2040,
    shrinkageRadial: 3.6,
    shrinkageTangential: 6.9,
    shrinkageVolumetric: 10.0,
    decayResistance: null,
  },
];

async function applyUpdates() {
  let updated = 0;
  let skippedAlreadyEnriched = 0;
  let notFound = 0;

  for (const record of UPDATE_RECORDS) {
    const existing = await prisma.species.findUnique({
      where: { scientificName: record.scientificName },
    });
    if (!existing) {
      console.warn(`  No DB row for ${record.scientificName} — skipping.`);
      notFound += 1;
      continue;
    }
    if (existing.modulusOfRupture != null) {
      console.log(
        `  ${record.scientificName} already USDA-enriched — leaving Table 5-3 data in place.`,
      );
      skippedAlreadyEnriched += 1;
      continue;
    }

    await prisma.species.update({
      where: { scientificName: record.scientificName },
      data: {
        density: record.specificGravity,
        modulusOfRupture: record.modulusOfRupture,
        modulusOfElasticity: record.modulusOfElasticity,
        compressionStrengthParallel: record.compressionStrengthParallel,
        ...(record.jankaHardness != null ? { jankaHardness: record.jankaHardness } : {}),
        shrinkageRadial: record.shrinkageRadial,
        shrinkageTangential: record.shrinkageTangential,
        shrinkageVolumetric: record.shrinkageVolumetric,
        decayResistance: record.decayResistance,
        attribution: ATTRIBUTION,
      },
    });
    console.log(`Updated ${record.scientificName} (${existing.commonName}) from Table 5-4`);
    updated += 1;
  }

  console.log(
    `\nTable 5-4: updated ${updated}, skipped (already enriched from Table 5-3) ${skippedAlreadyEnriched}, not found ${notFound}.\n`,
  );
}

async function createNewSpecies() {
  let created = 0;

  for (let i = 0; i < NEW_SPECIES.length; i += 1) {
    const candidate = NEW_SPECIES[i];
    const existing = await prisma.species.findUnique({
      where: { scientificName: candidate.scientificName },
    });
    if (existing) {
      console.log(`  ${candidate.scientificName} already exists — updating USDA fields only.`);
      await prisma.species.update({
        where: { scientificName: candidate.scientificName },
        data: {
          density: candidate.specificGravity,
          modulusOfRupture: candidate.modulusOfRupture,
          modulusOfElasticity: candidate.modulusOfElasticity,
          compressionStrengthParallel: candidate.compressionStrengthParallel,
          ...(candidate.jankaHardness != null ? { jankaHardness: candidate.jankaHardness } : {}),
          shrinkageRadial: candidate.shrinkageRadial,
          shrinkageTangential: candidate.shrinkageTangential,
          shrinkageVolumetric: candidate.shrinkageVolumetric,
          decayResistance: candidate.decayResistance,
          attribution: ATTRIBUTION,
        },
      });
      created += 1;
      continue;
    }

    console.log(`Creating ${i + 1} of ${NEW_SPECIES.length}: ${candidate.commonName}`);
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
        // Authoritative USDA numbers take precedence over anything Haiku would estimate.
        jankaHardness:
          candidate.jankaHardness ??
          (woodProperties ? Math.round(woodProperties.jankaHardness) : 0),
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

  console.log(`\nTable 5-5: created/updated ${created}.\n`);
}

async function main() {
  console.log('=== Table 5-4 (Canadian-grown species) ===\n');
  await applyUpdates();

  console.log('=== Table 5-5 (other imported species) ===\n');
  await createNewSpecies();

  const total = await prisma.species.count();
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
