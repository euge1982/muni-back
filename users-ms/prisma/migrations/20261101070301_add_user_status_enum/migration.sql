
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- Convert existing status values without dropping the column
ALTER TABLE "users"
ALTER COLUMN "status" TYPE "UserStatus"
USING "status"::"UserStatus";

-- Set default status for new users
ALTER TABLE "users"
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
