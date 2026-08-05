-- AlterTable
ALTER TABLE "Species" ADD COLUMN     "hasNoCommonName" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasNoJankaData" BOOLEAN NOT NULL DEFAULT false;
