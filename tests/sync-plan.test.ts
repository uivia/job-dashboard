import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { decideSyncEvent, mergeAppliedAt, mergeJobPostingUrl, mergeTechStack, type ExistingApplication } from "../src/lib/gmail/sync-plan.ts";
import type { ParsedJobEvent } from "../src/lib/domain.ts";

const existing: ExistingApplication = {
  id: "job-1",
  origin: "GMAIL",
  title: "Python Engineer",
  company: "Acme",
  techStack: ["Python"],
  status: "INTERVIEW",
  statusUpdatedAt: new Date("2026-09-24T08:00:00Z"),
  appliedAt: new Date("2026-09-01T08:00:00Z"),
  jobPostingUrl: "https://example.com/jobs/python-engineer",
  threadIds: ["thread-1"]
};

function event(overrides: Partial<ParsedJobEvent> = {}): ParsedJobEvent {
  return {
    messageId: "message-2",
    threadId: "thread-2",
    receivedAt: new Date("2026-09-25T08:00:00Z"),
    title: "Python Engineer",
    company: "Acme",
    techStack: ["Python"],
    status: "OFFER",
    jobPostingUrl: null,
    ...overrides
  };
}

describe("decideSyncEvent", () => {
  test("updates the application matched by Gmail thread", () => {
    const decision = decideSyncEvent(event({ threadId: "thread-1", title: "", company: "" }), [existing]);
    assert.deepEqual(decision, { kind: "UPDATE", applicationId: "job-1", status: "OFFER" });
  });

  test("does not replace a newer manual status", () => {
    const decision = decideSyncEvent(event({ receivedAt: new Date("2026-09-23T08:00:00Z") }), [existing]);
    assert.deepEqual(decision, { kind: "IGNORE", applicationId: "job-1", reason: "STALE_STATUS" });
  });

  test("enriches a blank posting URL from a stale matched email without changing status", () => {
    const decision = decideSyncEvent(
      event({
        receivedAt: new Date("2026-09-23T08:00:00Z"),
        jobPostingUrl: "https://example.com/jobs/python-engineer"
      }),
      [{ ...existing, jobPostingUrl: null }]
    );

    assert.deepEqual(decision, { kind: "ENRICH", applicationId: "job-1" });
  });

  test("adds a complete application when no record matches", () => {
    const decision = decideSyncEvent(event({ title: "React Developer", company: "Beta Labs", status: "APPLIED" }), [existing]);
    assert.deepEqual(decision, { kind: "ADD" });
  });

  test("enriches a missing date from an older confirmation on another thread", () => {
    const decision = decideSyncEvent(
      event({ status: "APPLIED", receivedAt: new Date("2026-09-01T08:00:00Z") }),
      [{ ...existing, appliedAt: null }]
    );
    assert.deepEqual(decision, { kind: "ENRICH", applicationId: "job-1" });
  });

  test("enriches an earlier confirmation on the same thread without downgrading status", () => {
    const decision = decideSyncEvent(
      event({ status: "APPLIED", threadId: "thread-1", receivedAt: new Date("2026-08-31T08:00:00Z") }),
      [existing]
    );
    assert.deepEqual(decision, { kind: "ENRICH", applicationId: "job-1" });
  });

  test("keeps a later reapplication separate when the previous date is known", () => {
    assert.deepEqual(decideSyncEvent(event({ status: "APPLIED" }), [existing]), { kind: "ADD" });
  });

  test("does not use ambiguous confirmation identities to fill missing dates", () => {
    const records = [{ ...existing, appliedAt: null }, { ...existing, id: "job-2", appliedAt: null }];
    assert.deepEqual(decideSyncEvent(event({ status: "APPLIED" }), records), { kind: "IGNORE", reason: "AMBIGUOUS_MATCH" });
  });

  test("merges duplicate acknowledgements received within fourteen days", () => {
    const recent = { ...existing, status: "APPLIED" as const, appliedAt: new Date("2026-09-20T08:00:00Z") };
    const decision = decideSyncEvent(event({ status: "APPLIED" }), [recent]);
    assert.deepEqual(decision, { kind: "UPDATE", applicationId: "job-1", status: "APPLIED" });
  });

  test("does not downgrade an interview when a duplicate acknowledgement arrives later", () => {
    const recentInterview = { ...existing, appliedAt: new Date("2026-09-20T08:00:00Z") };
    const decision = decideSyncEvent(event({ status: "APPLIED" }), [recentInterview]);
    assert.deepEqual(decision, { kind: "UPDATE", applicationId: "job-1", status: "INTERVIEW" });
  });

  test("skips ambiguous title and company matches", () => {
    const duplicate = { ...existing, id: "job-2", threadIds: ["thread-other"] };
    const decision = decideSyncEvent(event(), [existing, duplicate]);
    assert.deepEqual(decision, { kind: "IGNORE", reason: "AMBIGUOUS_MATCH" });
  });

  test("skips events without enough identity to create a job", () => {
    const decision = decideSyncEvent(event({ threadId: null, title: "", company: "" }), [existing]);
    assert.deepEqual(decision, { kind: "IGNORE", reason: "MISSING_IDENTITY" });
  });
});

describe("mergeAppliedAt", () => {
  test("fills a missing Gmail application date from a confirmation", () => {
    const confirmation = event({ status: "APPLIED" });
    assert.deepEqual(mergeAppliedAt({ ...existing, appliedAt: null }, confirmation), confirmation.receivedAt);
  });

  test("keeps the earliest confirmation date", () => {
    const confirmation = event({ status: "APPLIED", receivedAt: new Date("2026-08-31T08:00:00Z") });
    assert.deepEqual(mergeAppliedAt(existing, confirmation), confirmation.receivedAt);
    assert.deepEqual(mergeAppliedAt(existing, event({ status: "APPLIED" })), existing.appliedAt);
  });

  test("does not invent an application date from a status email", () => {
    assert.equal(mergeAppliedAt({ ...existing, appliedAt: null }, event()), null);
  });

  test("preserves manual application dates", () => {
    const confirmation = event({ status: "APPLIED", receivedAt: new Date("2026-08-31T08:00:00Z") });
    assert.deepEqual(mergeAppliedAt({ ...existing, origin: "MANUAL" }, confirmation), existing.appliedAt);
  });
});

describe("mergeTechStack", () => {
  test("fills an empty stack from a later email", () => {
    assert.deepEqual(mergeTechStack([], ["Python", "React"]), ["Python", "React"]);
  });

  test("preserves an existing manual stack", () => {
    assert.deepEqual(mergeTechStack(["Django"], ["Python"]), ["Django"]);
  });
});

describe("mergeJobPostingUrl", () => {
  test("fills a blank posting URL from a later email", () => {
    assert.equal(mergeJobPostingUrl(null, "https://example.com/jobs/engineer"), "https://example.com/jobs/engineer");
  });

  test("preserves an existing posting URL", () => {
    assert.equal(
      mergeJobPostingUrl("https://manual.example/jobs/engineer", "https://email.example/jobs/engineer"),
      "https://manual.example/jobs/engineer"
    );
  });
});
