-- AlterTable
ALTER TABLE "Species" ADD COLUMN     "compressionStrengthParallel" INTEGER,
ADD COLUMN     "decayResistance" TEXT,
ADD COLUMN     "dryingDifficulty" TEXT,
ADD COLUMN     "modulusOfElasticity" INTEGER,
ADD COLUMN     "modulusOfRupture" INTEGER,
ADD COLUMN     "shrinkageRadial" DOUBLE PRECISION,
ADD COLUMN     "shrinkageTangential" DOUBLE PRECISION,
ADD COLUMN     "shrinkageVolumetric" DOUBLE PRECISION;
