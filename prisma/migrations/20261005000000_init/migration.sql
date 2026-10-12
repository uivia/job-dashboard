CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'SCREENING', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "ApplicationOrigin" AS ENUM ('GMAIL', 'MANUAL');
CREATE TYPE "EmailOutcome" AS ENUM ('ADDED', 'UPDATED', 'IGNORED', 'FAILED');

CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "techStack" TEXT[] NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "origin" "ApplicationOrigin" NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "statusUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcessedEmail" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "threadId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "outcome" "EmailOutcome" NOT NULL,
    "reasonCode" TEXT,
    "inferredStatus" "ApplicationStatus",
    "applicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessedEmail_messageId_key" ON "ProcessedEmail"("messageId");
CREATE INDEX "JobApplication_statusUpdatedAt_idx" ON "JobApplication"("statusUpdatedAt");
CREATE INDEX "ProcessedEmail_threadId_idx" ON "ProcessedEmail"("threadId");
CREATE INDEX "ProcessedEmail_applicationId_idx" ON "ProcessedEmail"("applicationId");
ALTER TABLE "ProcessedEmail" ADD CONSTRAINT "ProcessedEmail_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
