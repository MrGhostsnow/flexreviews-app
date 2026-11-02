-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "reviewerCustomerId" BIGINT,
ADD COLUMN     "reviewerEmailHash" TEXT;

-- CreateTable
CREATE TABLE "RedactedCustomer" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "customerId" BIGINT,
    "emailHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedactedCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RedactedCustomer_shop_idx" ON "RedactedCustomer"("shop");

-- CreateIndex
CREATE INDEX "Review_shop_reviewerCustomerId_idx" ON "Review"("shop", "reviewerCustomerId");

-- CreateIndex
CREATE INDEX "Review_shop_reviewerEmailHash_idx" ON "Review"("shop", "reviewerEmailHash");

-- AddForeignKey
ALTER TABLE "RedactedCustomer" ADD CONSTRAINT "RedactedCustomer_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("shop") ON DELETE CASCADE ON UPDATE CASCADE;
