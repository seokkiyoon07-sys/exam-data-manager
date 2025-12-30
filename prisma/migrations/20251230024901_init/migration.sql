-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'WORKER');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE', 'SUBJECTIVE');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('ERROR', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'WORKER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "problemType" TEXT,
    "examCode" TEXT,
    "organization" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subCategory" TEXT,
    "examYear" INTEGER NOT NULL,
    "problemNumber" INTEGER NOT NULL,
    "questionType" "QuestionType" NOT NULL DEFAULT 'MULTIPLE',
    "answer" TEXT,
    "difficulty" TEXT,
    "score" DOUBLE PRECISION,
    "correctRate" DOUBLE PRECISION,
    "choiceRate1" DOUBLE PRECISION,
    "choiceRate2" DOUBLE PRECISION,
    "choiceRate3" DOUBLE PRECISION,
    "choiceRate4" DOUBLE PRECISION,
    "choiceRate5" DOUBLE PRECISION,
    "problemPosted" BOOLEAN NOT NULL DEFAULT false,
    "problemWorker" TEXT,
    "problemWorkDate" TIMESTAMP(3),
    "solutionPosted" BOOLEAN NOT NULL DEFAULT false,
    "solutionWorker" TEXT,
    "solutionWorkDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationIssue" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'ERROR',
    "field" TEXT,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLog" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadHistory" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successRows" INTEGER NOT NULL,
    "failedRows" INTEGER NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'PROCESSING',
    "errorMessage" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UploadHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Problem_index_key" ON "Problem"("index");

-- CreateIndex
CREATE INDEX "Problem_subject_examYear_idx" ON "Problem"("subject", "examYear");

-- CreateIndex
CREATE INDEX "Problem_problemPosted_solutionPosted_idx" ON "Problem"("problemPosted", "solutionPosted");

-- CreateIndex
CREATE INDEX "Problem_problemWorker_idx" ON "Problem"("problemWorker");

-- CreateIndex
CREATE INDEX "Problem_solutionWorker_idx" ON "Problem"("solutionWorker");

-- CreateIndex
CREATE UNIQUE INDEX "Problem_examCode_problemNumber_key" ON "Problem"("examCode", "problemNumber");

-- CreateIndex
CREATE INDEX "ValidationIssue_problemId_idx" ON "ValidationIssue"("problemId");

-- CreateIndex
CREATE INDEX "ValidationIssue_ruleCode_idx" ON "ValidationIssue"("ruleCode");

-- CreateIndex
CREATE INDEX "ValidationIssue_resolved_idx" ON "ValidationIssue"("resolved");

-- CreateIndex
CREATE INDEX "WorkLog_problemId_idx" ON "WorkLog"("problemId");

-- CreateIndex
CREATE INDEX "WorkLog_userId_idx" ON "WorkLog"("userId");

-- CreateIndex
CREATE INDEX "WorkLog_createdAt_idx" ON "WorkLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ValidationIssue" ADD CONSTRAINT "ValidationIssue_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
