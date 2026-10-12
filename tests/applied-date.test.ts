import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { formatAppliedDate } from "../src/lib/applied-date.ts";

const now = new Date("2026-10-12T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("formatAppliedDate", () => {
  for (const [days, expected] of [
    [0, "Today"], [1, "1 day ago"], [2, "2 days ago"], [6, "6 days ago"],
    [7, "1 week ago"], [14, "2 weeks ago"], [28, "4 weeks ago"], [29, "4 weeks ago"],
    [30, "1 month ago"], [59, "1 month ago"], [60, "2 months ago"]] as const) {
    test(`shows ${expected} at ${days} complete days`, () => {
      const appliedAt = new Date(now.getTime() - days * DAY).toISOString();
      assert.equal(formatAppliedDate(appliedAt, now)?.relative, expected);
    });
  }

  test("waits for a full day before switching from Today", () => {
    assert.equal(formatAppliedDate("2026-10-11T12:00:01Z", now)?.relative, "Today");
  });

  test("formats the exact timestamp in Manila without a timezone label", () => {
    assert.equal(formatAppliedDate("2026-10-05T01:22:27Z", now)?.exact, "October 5, 2026 at 9:22:27 AM");
  });

  test("uses the next Manila calendar date when UTC has not reached midnight", () => {
    assert.equal(formatAppliedDate("2026-10-04T17:22:27Z", now)?.exact, "October 5, 2026 at 1:22:27 AM");
  });

  test("returns no display date for missing, invalid, or future timestamps", () => {
    for (const appliedAt of [null, "", "invalid", "2026-10-12T12:00:01Z"]) {
      assert.equal(formatAppliedDate(appliedAt, now), null);
    }
  });
});
