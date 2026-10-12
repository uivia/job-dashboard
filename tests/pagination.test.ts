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

  for (const pageSize of [10, 25, 50, 100]) {
    test(`returns the requested ${pageSize}-record window`, () => {
      assert.deepEqual(getPagination("2", 201, String(pageSize)), {
        page: 2,
        pageSize,
        skip: pageSize,
        totalPages: Math.ceil(201 / pageSize)
      });
    });
  }

  test("defaults missing and invalid page sizes to ten records", () => {
    for (const rawPageSize of [undefined, "", "invalid", "0", "-25", "25.5", "20", "101", "Infinity"]) {
      assert.deepEqual(getPagination("2", 26, rawPageSize), {
        page: 2,
        pageSize: 10,
        skip: 10,
        totalPages: 3
      });
    }
  });

  test("uses the first repeated page and page-size parameter", () => {
    assert.deepEqual(getPagination(["2", "3"], 76, ["25", "100"]), {
      page: 2,
      pageSize: 25,
      skip: 25,
      totalPages: 4
    });
    assert.equal(getPagination("1", 76, ["invalid", "25"]).pageSize, 10);
  });

  test("clamps to a partial final page for the selected size", () => {
    assert.deepEqual(getPagination("99", 51, "25"), {
      page: 3,
      pageSize: 25,
      skip: 50,
      totalPages: 3
    });
  });

  test("clamps the page after the final record on that page is deleted", () => {
    assert.deepEqual(getPagination("3", 50, "25"), {
      page: 2,
      pageSize: 25,
      skip: 25,
      totalPages: 2
    });
  });

  test("keeps empty datasets on page one with the selected size", () => {
    assert.deepEqual(getPagination("2", 0, "100"), {
      page: 1,
      pageSize: 100,
      skip: 0,
      totalPages: 1
    });
  });
});
