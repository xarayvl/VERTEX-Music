export type GoogleIdentityClaims = {
  sub?: string | null;
  email?: string | null;
  email_verified?: boolean | null;
  name?: string | null;
  picture?: string | null;
};

export class InvalidGoogleIdentityError extends Error {}

export type VerifiedGoogleIdentity = {
  googleId: string;
  email: string;
  name: string;
  picture: string;
};

type GoogleLinkableAccount = {
  email: string;
  googleId?: string;
};

export type GoogleSignInAccountMatch<T extends GoogleLinkableAccount> =
  | { kind: 'linked'; account: T }
  | { kind: 'email-conflict'; account: T }
  | { kind: 'new' };

/**
 * Google identity claims are suitable for sign-in or account linking only
 * when Google explicitly asserts ownership of the email address. Missing and
 * null email_verified claims must fail closed, just like false.
 */
export function getVerifiedGoogleIdentity(payload: GoogleIdentityClaims | null | undefined): VerifiedGoogleIdentity {
  const googleId = typeof payload?.sub === 'string' ? payload.sub.trim() : '';
  const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';

  if (!googleId || googleId.length > 255 || !email || email.length > 254) {
    throw new InvalidGoogleIdentityError('Invalid Google credential.');
  }
  if (payload?.email_verified !== true) {
    throw new InvalidGoogleIdentityError('Google account email is not verified.');
  }

  return {
    googleId,
    email,
    name: typeof payload.name === 'string' ? payload.name.trim().slice(0, 80) : '',
    picture: typeof payload.picture === 'string' ? payload.picture.trim().slice(0, 2_000) : '',
  };
}

/** Match only Google's stable subject. An email match is a conflict, never an
 * implicit account link or successful sign-in. */
export function classifyGoogleSignInAccount<T extends GoogleLinkableAccount>(
  accounts: T[],
  identity: VerifiedGoogleIdentity,
): GoogleSignInAccountMatch<T> {
  const linked = accounts.find((account) => account.googleId === identity.googleId);
  if (linked) return { kind: 'linked', account: linked };

  const emailConflict = accounts.find((account) => account.email.trim().toLowerCase() === identity.email);
  if (emailConflict) return { kind: 'email-conflict', account: emailConflict };
  return { kind: 'new' };
}
