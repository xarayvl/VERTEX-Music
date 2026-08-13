import assert from "node:assert/strict";
import test from "node:test";
import { getVerifiedGoogleIdentity, resolveGoogleSignIn } from "./googleAuthSecurity.js";

test("Google identity parsing fails closed unless email_verified is exactly true", () => {
  const basePayload = { sub: "google-subject", email: "Victim@Example.com" };

  for (const emailVerified of [undefined, false, "true", 1, null]) {
    const result = getVerifiedGoogleIdentity({ ...basePayload, email_verified: emailVerified });
    assert.deepEqual(result, { ok: false, reason: "email_unverified" });
  }

  const verified = getVerifiedGoogleIdentity({
    ...basePayload,
    email_verified: true,
    name: "  Victim  ",
  });
  assert.deepEqual(verified, {
    ok: true,
    identity: {
      googleId: "google-subject",
      email: "victim@example.com",
      name: "Victim",
      picture: "",
    },
  });
});

test("Google sign-in never authorizes an unlinked account by matching email", () => {
  const users = [{
    id: "usr_local",
    username: "local",
    email: "victim@example.com",
    googleId: undefined,
  }];
  const identity = {
    googleId: "google-victim",
    email: "victim@example.com",
    name: "Victim",
    picture: "",
  };

  const resolution = resolveGoogleSignIn(users, identity);
  assert.equal(resolution.kind, "email_conflict");
  if (resolution.kind === "email_conflict") {
    assert.equal(resolution.user.id, "usr_local");
  }
});

test("Google sign-in accepts an existing subject mapping and otherwise creates a new account", () => {
  const linkedUser = {
    id: "usr_linked",
    email: "old-address@example.com",
    googleId: "google-subject",
  };
  const users = [linkedUser];

  const existing = resolveGoogleSignIn(users, {
    googleId: "google-subject",
    email: "new-address@example.com",
    name: "",
    picture: "",
  });
  assert.equal(existing.kind, "linked_account");
  if (existing.kind === "linked_account") assert.equal(existing.user, linkedUser);

  const fresh = resolveGoogleSignIn(users, {
    googleId: "another-subject",
    email: "another@example.com",
    name: "",
    picture: "",
  });
  assert.deepEqual(fresh, { kind: "new_account" });
});
