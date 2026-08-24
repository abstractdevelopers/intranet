-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "externalId" TEXT,
ADD COLUMN "url" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_externalId_key" ON "Workspace"("externalId");
