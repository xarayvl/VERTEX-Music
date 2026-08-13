export interface GoogleTokenPayloadLike {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  picture?: unknown;
}

export interface VerifiedGoogleIdentity {
  googleId: string;
  email: string;
  name: string;
  picture: string;
}

export type GoogleIdentityResult =
  | { ok: true; identity: VerifiedGoogleIdentity }
  | { ok: false; reason: "invalid" | "email_unverified" };

/**
 * Treat Google's email claim as proof of ownership only when the provider
 * explicitly marks it verified. Missing and non-boolean values must fail
 * closed; accepting everything except `false` recreates a pre-hijacking path.
 */
export function getVerifiedGoogleIdentity(payload: GoogleTokenPayloadLike | null | undefined): GoogleIdentityResult {
  if (
    !payload ||
    typeof payload.sub !== "string" ||
    !payload.sub.trim() ||
    payload.sub.trim().length > 255 ||
    typeof payload.email !== "string" ||
    !payload.email.trim() ||
    payload.email.trim().length > 254
  ) {
    return { ok: false, reason: "invalid" };
  }

  if (payload.email_verified !== true) {
    return { ok: false, reason: "email_unverified" };
  }

  return {
    ok: true,
    identity: {
      googleId: payload.sub.trim(),
      email: payload.email.trim().toLowerCase(),
      name: typeof payload.name === "string" ? payload.name.trim().slice(0, 80) : "",
      picture: typeof payload.picture === "string" ? payload.picture.trim().slice(0, 2_000) : "",
    },
  };
}

interface GoogleAccountRecord {
  id: string;
  email: string;
  googleId?: string;
}

export type GoogleSignInResolution<T extends GoogleAccountRecord> =
  | { kind: "linked_account"; user: T }
  | { kind: "email_conflict"; user: T }
  | { kind: "new_account" };

/**
 * Google sign-in is resolved only by Google's stable subject identifier.
 * A matching local email is a conflict that requires an explicit, stepped-up
 * link operation; it is never an authorization decision by itself.
 */
export function resolveGoogleSignIn<T extends GoogleAccountRecord>(
  users: T[],
  identity: VerifiedGoogleIdentity
): GoogleSignInResolution<T> {
  const linkedAccount = users.find((user) => user.googleId === identity.googleId);
  if (linkedAccount) return { kind: "linked_account", user: linkedAccount };

  const emailConflict = users.find((user) => user.email.trim().toLowerCase() === identity.email);
  if (emailConflict) return { kind: "email_conflict", user: emailConflict };

  return { kind: "new_account" };
}
