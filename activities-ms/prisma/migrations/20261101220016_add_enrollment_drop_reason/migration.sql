-- CreateEnum
CREATE TYPE "EnrollmentDropReason" AS ENUM ('ABSENCES', 'ILLNESS', 'ADMINISTRATIVE', 'OTHER');

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "dropReason" "EnrollmentDropReason";
