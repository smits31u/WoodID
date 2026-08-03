import { prisma } from '../src/db/client.js';

// Genera pulled in by the original broad Wikidata family import (TIMBER_FAMILIES included
// families like Rosaceae, Lamiaceae, Myrtaceae, Moraceae, Salicaceae that are mostly
// ornamentals/shrubs/fruit trees, not lumber) — deleting them wholesale.
const JUNK_GENERA = [
  'Rosa',
  'Banksia',
  'Callicarpa',
  'Salix',
  'Vitex',
  'Scutellaria',
  'Lallemantia',
  'Geum',
  'Acaena',
  'Ficus',
  'Syzygium',
  // Not named explicitly by the user, but clearly ornamental/herbaceous Rosaceae or
  // Malvaceae/Anacardiaceae shrubs matching the same "roses, shrubs, ornamentals" pattern.
  'Physocarpus',
  'Cotoneaster',
  'Vauquelinia',
  'Kageneckia',
  'Alyogyne',
  'Cotinus',
  // The Chinese lacquer tree — grown for sap/lacquer, not lumber, and its wood/sap contains
  // urushiol (same irritant as poison ivy), a real handling hazard for a wood-ID app.
  'Toxicodendron',
];

// Diospyros (persimmon/ebony genus) — keep only the two persimmons the user named.
const DIOSPYROS_KEEP = ['Diospyros virginiana', 'Diospyros kaki'];

// Named individually, not by genus.
const JUNK_EXACT_NAMES = ['Holmskioldia sanguinea', 'Rhoiptelea chiliantha'];

async function main() {
  let totalDeleted = 0;

  for (const genus of JUNK_GENERA) {
    const { count } = await prisma.species.deleteMany({
      where: { scientificName: { startsWith: `${genus} ` } },
    });
    console.log(`Deleted ${count} ${genus} species`);
    totalDeleted += count;
  }

  const diospyrosDeleted = await prisma.species.deleteMany({
    where: {
      scientificName: { startsWith: 'Diospyros ' },
      NOT: { scientificName: { in: DIOSPYROS_KEEP } },
    },
  });
  console.log(
    `Deleted ${diospyrosDeleted.count} Diospyros species (kept ${DIOSPYROS_KEEP.join(', ')})`,
  );
  totalDeleted += diospyrosDeleted.count;

  const exactDeleted = await prisma.species.deleteMany({
    where: { scientificName: { in: JUNK_EXACT_NAMES } },
  });
  console.log(`Deleted ${exactDeleted.count} individually-named junk species`);
  totalDeleted += exactDeleted.count;

  console.log(`\nTotal deleted: ${totalDeleted}`);
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
