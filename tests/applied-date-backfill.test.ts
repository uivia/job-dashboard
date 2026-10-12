import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

test("backfills the earliest linked confirmation and preserves manual dates and statuses", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(`
      CREATE TABLE "JobApplication" (
        "id" TEXT PRIMARY KEY, "origin" TEXT, "appliedAt" TEXT,
        "status" TEXT DEFAULT 'INTERVIEW', "statusUpdatedAt" TEXT DEFAULT '2026-10-10T08:00:00Z'
      );
      CREATE TABLE "ProcessedEmail" (
        "applicationId" TEXT, "inferredStatus" TEXT, "receivedAt" TEXT, "outcome" TEXT
      );
      INSERT INTO "JobApplication" ("id", "origin", "appliedAt") VALUES
        ('missing', 'GMAIL', NULL),
        ('late', 'GMAIL', '2026-10-05T08:00:00Z'),
        ('early', 'GMAIL', '2026-10-01T08:00:00Z'),
        ('manual', 'MANUAL', '2026-10-05T08:00:00Z'),
        ('unknown', 'GMAIL', NULL);
      INSERT INTO "ProcessedEmail" VALUES
        ('missing', 'APPLIED', '2026-10-04T08:00:00Z', 'UPDATED'),
        ('missing', 'APPLIED', '2026-10-02T08:00:00Z', 'IGNORED'),
        ('late', 'APPLIED', '2026-10-02T08:00:00Z', 'ADDED'),
        ('early', 'APPLIED', '2026-10-02T08:00:00Z', 'UPDATED'),
        ('manual', 'APPLIED', '2026-10-02T08:00:00Z', 'UPDATED'),
        ('unknown', 'INTERVIEW', '2026-10-02T08:00:00Z', 'ADDED'),
        (NULL, 'APPLIED', '2026-10-01T08:00:00Z', 'IGNORED');
    `);

    // Execute the migration's portable SQL against isolated, in-memory tables.
    const migration = readFileSync(new URL("../prisma/migrations/20261012010000_backfill_applied_at/migration.sql", import.meta.url), "utf8");
    database.exec(migration);
    const rows = database.prepare('SELECT "id", "appliedAt", "status", "statusUpdatedAt" FROM "JobApplication" ORDER BY "id"').all();
    assert.deepEqual(rows.map((row) => [row.id, row.appliedAt]), [
      ["early", "2026-10-01T08:00:00Z"],
      ["late", "2026-10-02T08:00:00Z"],
      ["manual", "2026-10-05T08:00:00Z"],
      ["missing", "2026-10-02T08:00:00Z"],
      ["unknown", null]
    ]);
    for (const row of rows) {
      assert.equal(row.status, "INTERVIEW");
      assert.equal(row.statusUpdatedAt, "2026-10-10T08:00:00Z");
    }
    database.exec(migration);
    assert.deepEqual(database.prepare('SELECT "id", "appliedAt", "status", "statusUpdatedAt" FROM "JobApplication" ORDER BY "id"').all(), rows);
  } finally {
    database.close();
  }
});
