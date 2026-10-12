import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getPagination } from "../src/lib/pagination.ts";

describe("getPagination", () => {
  test("returns the ten-record window for the requested page", () => {
    assert.deepEqual(getPagination("3", 25), {
      page: 3,
      pageSize: 10,
      skip: 20,
      totalPages: 3
    });
  });

  test("clamps invalid and out-of-range page values", () => {
    assert.equal(getPagination("invalid", 25).page, 1);
    assert.equal(getPagination("99", 25).page, 3);
    assert.equal(getPagination("2", 0).page, 1);
  });
});
