-- CreateTable
CREATE TABLE "Shop" (
    "shop" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "judgeMeToken" TEXT,
    "syncInterval" INTEGER NOT NULL DEFAULT 60,
    "lastSyncedAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("shop")
);

-- CreateTable
CREATE TABLE "Review" (
    "shop" TEXT NOT NULL,
    "sourceProvider" TEXT NOT NULL,
    "sourceReviewId" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "productExternalId" BIGINT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "reviewerName" TEXT,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasPublishedPictures" BOOLEAN NOT NULL DEFAULT false,
    "hasPublishedVideos" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBuyerStatus" TEXT,
    "createdAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("shop","sourceProvider","sourceReviewId")
);

-- CreateIndex
CREATE INDEX "Review_shop_productExternalId_idx" ON "Review"("shop", "productExternalId");

-- CreateIndex
CREATE INDEX "Review_shop_createdAt_idx" ON "Review"("shop", "createdAt");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("shop") ON DELETE CASCADE ON UPDATE CASCADE;
