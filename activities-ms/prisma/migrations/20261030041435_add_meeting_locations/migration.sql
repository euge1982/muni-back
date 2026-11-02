-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "locationId" INTEGER;

-- CreateTable
CREATE TABLE "meeting_locations" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(65,30) NOT NULL,
    "longitude" DECIMAL(65,30) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_locations_name_key" ON "meeting_locations"("name");

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "meeting_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
