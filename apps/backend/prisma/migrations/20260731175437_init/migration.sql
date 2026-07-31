-- CreateTable
CREATE TABLE "Species" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "commonName" TEXT NOT NULL,
    "scientificName" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "originRegions" TEXT NOT NULL,
    "jankaHardness" INTEGER NOT NULL,
    "density" DOUBLE PRECISION NOT NULL,
    "grainType" TEXT NOT NULL,
    "texture" TEXT NOT NULL,
    "poreStructure" TEXT NOT NULL,
    "heartwoodColor" TEXT NOT NULL,
    "sapwoodColor" TEXT NOT NULL,
    "workabilityRating" INTEGER NOT NULL,
    "workabilityNotes" TEXT NOT NULL,
    "commonUses" TEXT NOT NULL,
    "sustainabilityStatus" TEXT NOT NULL,
    "citesListed" BOOLEAN NOT NULL,

    CONSTRAINT "Species_pkey" PRIMARY KEY ("id")
);
