import { prisma } from '../src/db/client.js';

const species = [
  {
    commonName: 'White Oak',
    scientificName: 'Quercus alba',
    family: 'Fagaceae',
    originRegions: 'Eastern North America',
    jankaHardness: 1360,
    density: 0.75,
    grainType: 'Straight',
    texture: 'Coarse',
    poreStructure: 'Ring-porous',
    heartwoodColor: 'Light to medium brown',
    sapwoodColor: 'Pale yellow-white',
    workabilityRating: 4,
    workabilityNotes:
      'Works well with hand and machine tools; pre-drilling recommended for nailing.',
    commonUses: 'Furniture, flooring, cabinetry, barrels, boat building',
    sustainabilityStatus: 'Least concern',
    citesListed: false,
  },
  {
    commonName: 'Black Walnut',
    scientificName: 'Juglans nigra',
    family: 'Juglandaceae',
    originRegions: 'Eastern United States',
    jankaHardness: 1010,
    density: 0.64,
    grainType: 'Straight, occasionally wavy',
    texture: 'Medium',
    poreStructure: 'Semi-ring-porous',
    heartwoodColor: 'Rich dark brown',
    sapwoodColor: 'Pale yellowish-gray',
    workabilityRating: 5,
    workabilityNotes:
      'Excellent workability with both hand and power tools; glues and finishes beautifully.',
    commonUses: 'Fine furniture, gunstocks, veneer, cabinetry',
    sustainabilityStatus: 'Least concern',
    citesListed: false,
  },
  {
    commonName: 'Brazilian Rosewood',
    scientificName: 'Dalbergia nigra',
    family: 'Fabaceae',
    originRegions: 'Brazil',
    jankaHardness: 2720,
    density: 0.85,
    grainType: 'Straight to interlocked',
    texture: 'Medium to fine',
    poreStructure: 'Diffuse-porous',
    heartwoodColor: 'Dark brown with black streaks',
    sapwoodColor: 'Pale yellow',
    workabilityRating: 3,
    workabilityNotes:
      'Can be difficult to work due to high density and interlocked grain; blunts cutting edges.',
    commonUses: 'High-end furniture, musical instruments, veneer',
    sustainabilityStatus: 'Endangered',
    citesListed: true,
  },
  {
    commonName: 'Eastern White Pine',
    scientificName: 'Pinus strobus',
    family: 'Pinaceae',
    originRegions: 'Eastern North America',
    jankaHardness: 380,
    density: 0.35,
    grainType: 'Straight',
    texture: 'Fine, even',
    poreStructure: 'Non-porous (softwood)',
    heartwoodColor: 'Light brown to reddish-brown',
    sapwoodColor: 'Pale yellow-white',
    workabilityRating: 5,
    workabilityNotes: 'Very easy to work with hand and machine tools; low blunting effect.',
    commonUses: 'Construction, millwork, furniture, carving',
    sustainabilityStatus: 'Least concern',
    citesListed: false,
  },
  {
    commonName: 'Teak',
    scientificName: 'Tectona grandis',
    family: 'Lamiaceae',
    originRegions: 'South and Southeast Asia',
    jankaHardness: 1070,
    density: 0.65,
    grainType: 'Straight, occasionally interlocked',
    texture: 'Coarse, uneven',
    poreStructure: 'Ring-porous',
    heartwoodColor: 'Golden to dark brown',
    sapwoodColor: 'Pale yellowish-white',
    workabilityRating: 4,
    workabilityNotes: 'Naturally oily; can dull tools but machines and finishes well overall.',
    commonUses: 'Outdoor furniture, boat decking, flooring, veneer',
    sustainabilityStatus: 'Vulnerable',
    citesListed: false,
  },
];

async function main() {
  for (const record of species) {
    await prisma.species.create({ data: record });
  }
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
