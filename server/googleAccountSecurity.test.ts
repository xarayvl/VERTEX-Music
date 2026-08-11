import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyGoogleSignInAccount, getVerifiedGoogleIdentity, InvalidGoogleIdentityError } from './googleAccountSecurity.js';

test('Google identity requires email_verified to be exactly true', () => {
  for (const emailVerified of [undefined, null, false]) {
    assert.throws(
      () => getVerifiedGoogleIdentity({ sub: 'google-subject', email: 'owner@example.com', email_verified: emailVerified }),
      InvalidGoogleIdentityError,
    );
  }
});

test('Google identity normalizes a verified email and preserves the subject', () => {
  assert.deepEqual(
    getVerifiedGoogleIdentity({
      sub: 'google-subject',
      email: ' Owner@Example.COM ',
      email_verified: true,
      name: ' Owner ',
    }),
    {
      googleId: 'google-subject',
      email: 'owner@example.com',
      name: 'Owner',
      picture: '',
    },
  );
});

test('an existing local email is a conflict and is never an implicit Google link', () => {
  const account = { id: 'local-user', email: 'owner@example.com' };
  const result = classifyGoogleSignInAccount([account], {
    googleId: 'google-subject',
    email: 'owner@example.com',
    name: '',
    picture: '',
  });

  assert.deepEqual(result, { kind: 'email-conflict', account });
});

test('Google sign-in matches an account only by its linked subject', () => {
  const linkedAccount = { id: 'linked-user', email: 'old-address@example.com', googleId: 'google-subject' };
  const result = classifyGoogleSignInAccount([linkedAccount], {
    googleId: 'google-subject',
    email: 'new-address@example.com',
    name: '',
    picture: '',
  });

  assert.deepEqual(result, { kind: 'linked', account: linkedAccount });
});
