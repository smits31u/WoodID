import { prisma } from '../src/db/client.js';
import { DENSITY_KG_M3_TO_G_CM3, fetchWoodProperties } from '../src/ai/woodProperties.js';

// Diospyros mespiliformis (Jackalberry / African Ebony) was caught in the Diospyros cleanup
// pass along with the persimmon ornamentals — it's a legitimate ebony timber, restoring it.
const commonName = 'Jackalberry';
const scientificName = 'Diospyros mespiliformis';
const family = 'Ebenaceae';
const originRegions = 'Sub-Saharan Africa';

async function main() {
  const woodProperties = await fetchWoodProperties(commonName, scientificName);
  if (!woodProperties) {
    throw new Error(`No wood properties returned for ${commonName}.`);
  }

  await prisma.species.upsert({
    where: { scientificName },
    update: {
      commonName,
      family,
      originRegions,
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
      sustainabilityStatus: 'Least concern',
      citesListed: false,
    },
    create: {
      commonName,
      scientificName,
      family,
      originRegions,
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
      sustainabilityStatus: 'Least concern',
      citesListed: false,
    },
  });

  console.log(`Restored ${scientificName} as "${commonName}".`);
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
