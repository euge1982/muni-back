-- CreateTable
CREATE TABLE "processed_absences" (
    "id" SERIAL NOT NULL,
    "enrollmentId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_absences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processed_absences_enrollmentId_sessionId_key" ON "processed_absences"("enrollmentId", "sessionId");
