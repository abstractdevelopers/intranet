-- CreateTable
CREATE TABLE "PeerBodyRound" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "courseId" TEXT,
    "pathway" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REVIEWING',
    "facilitatorId" TEXT NOT NULL,
    "closesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeerBodyRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeerBodySubmission" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeerBodySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeerBodyReview" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "whatLanded" TEXT NOT NULL,
    "oneSuggestion" TEXT NOT NULL,
    "oneQuestion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeerBodyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promise" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PeerBodyRound_status_createdAt_idx" ON "PeerBodyRound"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PeerBodyRound_courseId_idx" ON "PeerBodyRound"("courseId");

-- CreateIndex
CREATE INDEX "PeerBodySubmission_roundId_createdAt_idx" ON "PeerBodySubmission"("roundId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PeerBodySubmission_roundId_authorId_key" ON "PeerBodySubmission"("roundId", "authorId");

-- CreateIndex
CREATE INDEX "PeerBodyReview_authorId_createdAt_idx" ON "PeerBodyReview"("authorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PeerBodyReview_submissionId_reviewerId_key" ON "PeerBodyReview"("submissionId", "reviewerId");

-- CreateIndex
CREATE INDEX "Promise_createdAt_idx" ON "Promise"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Promise_userId_key" ON "Promise"("userId");

-- AddForeignKey
ALTER TABLE "PeerBodyRound" ADD CONSTRAINT "PeerBodyRound_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerBodyRound" ADD CONSTRAINT "PeerBodyRound_facilitatorId_fkey" FOREIGN KEY ("facilitatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerBodySubmission" ADD CONSTRAINT "PeerBodySubmission_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "PeerBodyRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerBodySubmission" ADD CONSTRAINT "PeerBodySubmission_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerBodyReview" ADD CONSTRAINT "PeerBodyReview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "PeerBodySubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerBodyReview" ADD CONSTRAINT "PeerBodyReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerBodyReview" ADD CONSTRAINT "PeerBodyReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promise" ADD CONSTRAINT "Promise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

