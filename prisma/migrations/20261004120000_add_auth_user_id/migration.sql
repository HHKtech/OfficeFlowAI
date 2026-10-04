-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('EMPLOYEE', 'ADMIN');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "authUserId" TEXT, ADD COLUMN "appRole" "AppRole" NOT NULL DEFAULT 'EMPLOYEE';

-- CreateIndex
CREATE UNIQUE INDEX "Employee_authUserId_key" ON "Employee"("authUserId");
