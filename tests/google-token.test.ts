import assert from "node:assert/strict";
import { test } from "node:test";
import { refreshGoogleToken } from "../src/lib/google-token.ts";

test("refreshGoogleToken returns a new access token and absolute expiry", async () => {
  const before = Math.floor(Date.now() / 1000);
  const result = await refreshGoogleToken("refresh", "client", "secret", async (_url, init) => {
    assert.match(String(init?.body), /grant_type=refresh_token/);
    return new Response(JSON.stringify({ access_token: "new-token", expires_in: 3600 }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  });

  assert.equal(result.accessToken, "new-token");
  assert.ok(result.expiresAt >= before + 3599);
});

test("refreshGoogleToken reports a rejected refresh", async () => {
  await assert.rejects(
    () =>
      refreshGoogleToken("refresh", "client", "secret", async () =>
        new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })
      ),
    /Unable to refresh Google authorization/
  );
});
