import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMediaStorageKey, getPrivateMediaOwner } from './mediaAccessPolicy.js';

test('media access policy separates public, private, and legacy keys', () => {
  assert.equal(classifyMediaStorageKey('public/usr_1/image_a.jpg'), 'public');
  assert.equal(classifyMediaStorageKey('private/usr_1/image_9b74c7ce-2570-4fc0-bfbd-2d58d53de218.jpg'), 'private');
  assert.equal(classifyMediaStorageKey('usr_1/image_legacy.jpg'), 'legacy');
});

test('private media ownership is derived only from strict staging keys', () => {
  assert.equal(getPrivateMediaOwner('private/usr_1/audio_9b74c7ce-2570-4fc0-bfbd-2d58d53de218.mp3'), 'usr_1');
  assert.equal(getPrivateMediaOwner('private/usr_1/arbitrary-file.mp3'), null);
  assert.equal(getPrivateMediaOwner('public/usr_1/audio_9b74c7ce-2570-4fc0-bfbd-2d58d53de218.mp3'), null);
});
