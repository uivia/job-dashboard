-- Recover dates from saved confirmations, including stale emails linked to a job.
WITH confirmations AS (
    SELECT "applicationId", MIN("receivedAt") AS "appliedAt"
    FROM "ProcessedEmail"
    WHERE "inferredStatus" = 'APPLIED' AND "applicationId" IS NOT NULL
    GROUP BY "applicationId"
)
UPDATE "JobApplication" AS application
SET "appliedAt" = confirmations."appliedAt"
FROM confirmations
WHERE application."id" = confirmations."applicationId"
  AND application."origin" = 'GMAIL'
  AND (application."appliedAt" IS NULL OR confirmations."appliedAt" < application."appliedAt");
