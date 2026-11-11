/*
  Warnings:

  - A unique constraint covering the columns `[qrToken]` on the table `attendance_sessions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "attendance_sessions" ADD COLUMN     "qrExpiresAt" TIMESTAMP(3),
ADD COLUMN     "qrToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sessions_qrToken_key" ON "attendance_sessions"("qrToken");
