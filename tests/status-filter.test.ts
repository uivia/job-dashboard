import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseStatusFilter, applicationListHref } from "../src/lib/status-filter.ts";

describe("parseStatusFilter", () => {
  test("accepts every existing application status", () => {
    for (const status of ["APPLIED", "SCREENING", "INTERVIEW", "ASSESSMENT", "OFFER", "REJECTED", "WITHDRAWN"]) {
      assert.equal(parseStatusFilter(status), status);
    }
  });

  test("shows all statuses for missing or invalid values", () => {
    for (const status of [undefined, "", "ALL", "interview", "UNKNOWN", " INTERVIEW "]) {
      assert.equal(parseStatusFilter(status), null);
    }
  });

  test("uses only the first repeated status parameter", () => {
    assert.equal(parseStatusFilter(["INTERVIEW", "OFFER"]), "INTERVIEW");
    assert.equal(parseStatusFilter(["invalid", "INTERVIEW"]), null);
    assert.equal(parseStatusFilter([]), null);
  });
});

describe("applicationListHref", () => {
  test("preserves the status and page size when navigating pages", () => {
    const url = new URL(applicationListHref({ status: "INTERVIEW", pageSize: 25, page: 3 }), "https://example.com");
    assert.equal(url.pathname, "/");
    assert.equal(url.searchParams.get("status"), "INTERVIEW");
    assert.equal(url.searchParams.get("pageSize"), "25");
    assert.equal(url.searchParams.get("page"), "3");
  });

  test("returns to page one when changing the filter or page size", () => {
    const url = new URL(applicationListHref({ status: "OFFER", pageSize: 50 }), "https://example.com");
    assert.equal(url.searchParams.get("status"), "OFFER");
    assert.equal(url.searchParams.get("pageSize"), "50");
    assert.equal(url.searchParams.has("page"), false);
  });

  test("clears the status and page while keeping the page size", () => {
    const url = new URL(applicationListHref({ status: null, pageSize: 100 }), "https://example.com");
    assert.equal(url.searchParams.has("status"), false);
    assert.equal(url.searchParams.has("page"), false);
    assert.equal(url.searchParams.get("pageSize"), "100");
  });
});
