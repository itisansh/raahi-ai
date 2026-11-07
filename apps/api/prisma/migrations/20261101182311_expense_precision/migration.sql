-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "allocations" JSONB,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);
