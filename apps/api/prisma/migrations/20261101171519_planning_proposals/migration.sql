-- CreateTable
CREATE TABLE "planning_proposals" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "context_trip_id" TEXT,
    "base_revision" INTEGER,
    "result_trip_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "approved_at" TIMESTAMPTZ(6),

    CONSTRAINT "planning_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "planning_proposals_owner_id_created_at_idx" ON "planning_proposals"("owner_id", "created_at");
