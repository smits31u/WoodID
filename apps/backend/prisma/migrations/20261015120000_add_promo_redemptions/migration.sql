-- CreateTable
CREATE TABLE "PromoRedemption" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" TEXT NOT NULL,
    "promoCodeId" INTEGER NOT NULL,

    CONSTRAINT "PromoRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromoRedemption_deviceId_idx" ON "PromoRedemption"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoRedemption_deviceId_promoCodeId_key" ON "PromoRedemption"("deviceId", "promoCodeId");

-- AddForeignKey
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
