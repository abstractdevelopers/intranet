-- Intranet 101: a standalone, compulsory intro assessment not attached to any
-- course. Answers live server-side in QuizOption.isCorrect and are never sent
-- to the client; max attempts is enforced in the submit route.
ALTER TABLE "User" ADD COLUMN "intranet101PassedAt" TIMESTAMP(3);

CREATE TABLE "Quiz" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "passMark" INTEGER NOT NULL DEFAULT 70,
  "maxAttempts" INTEGER NOT NULL DEFAULT 2,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Quiz_slug_key" ON "Quiz"("slug");

CREATE TABLE "QuizQuestion" (
  "id" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "explanation" TEXT,
  "order" INTEGER NOT NULL,
  CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QuizQuestion_quizId_order_idx" ON "QuizQuestion"("quizId", "order");

CREATE TABLE "QuizOption" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL,
  CONSTRAINT "QuizOption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QuizOption_questionId_order_idx" ON "QuizOption"("questionId", "order");

CREATE TABLE "QuizAttempt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "answers" JSONB NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QuizAttempt_userId_quizId_idx" ON "QuizAttempt"("userId", "quizId");

ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizOption" ADD CONSTRAINT "QuizOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
