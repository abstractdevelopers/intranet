-- AlterTable
ALTER TABLE "Promise" ADD COLUMN     "goal" TEXT,
ADD COLUMN     "pathway" TEXT;

-- CreateTable
CREATE TABLE "PromiseCheer" (
    "id" TEXT NOT NULL,
    "promiseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromiseCheer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromiseCheer_userId_idx" ON "PromiseCheer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PromiseCheer_promiseId_userId_key" ON "PromiseCheer"("promiseId", "userId");

-- CreateIndex
CREATE INDEX "Promise_pathway_idx" ON "Promise"("pathway");

-- AddForeignKey
ALTER TABLE "PromiseCheer" ADD CONSTRAINT "PromiseCheer_promiseId_fkey" FOREIGN KEY ("promiseId") REFERENCES "Promise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromiseCheer" ADD CONSTRAINT "PromiseCheer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

