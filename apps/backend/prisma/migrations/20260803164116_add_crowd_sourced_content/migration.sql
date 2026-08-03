-- CreateEnum
CREATE TYPE "PhotoAngle" AS ENUM ('FACE_GRAIN', 'EDGE_GRAIN', 'END_GRAIN');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ReferencePhoto" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "speciesId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "angle" "PhotoAngle" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING',
    "deviceId" TEXT NOT NULL,

    CONSTRAINT "ReferencePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeciesSuggestion" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proposedCommonName" TEXT NOT NULL,
    "proposedScientificName" TEXT,
    "submitterNotes" TEXT,
    "deviceId" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "SpeciesSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionPhoto" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suggestionId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,

    CONSTRAINT "SuggestionPhoto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ReferencePhoto" ADD CONSTRAINT "ReferencePhoto_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionPhoto" ADD CONSTRAINT "SuggestionPhoto_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "SpeciesSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
