import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalizeManagedMediaUrl,
  getManagedStorageKey,
  mediaUrlForKey,
  normalizeR2PublicBaseUrl,
} from './r2Media.js';

test('r2.dev media stays on the authenticated same-origin proxy', () => {
  const publicBaseUrl = normalizeR2PublicBaseUrl('https://pub-example.r2.dev');

  assert.equal(mediaUrlForKey('user/audio file.mp3'), '/api/r2-file/user/audio%20file.mp3');
  assert.equal(
    canonicalizeManagedMediaUrl('https://pub-example.r2.dev/user/cover%20art.jpg', publicBaseUrl),
    '/api/r2-file/user/cover%20art.jpg',
  );
});

test('a legacy custom R2 domain is migrated and never used for live reads', () => {
  const publicBaseUrl = normalizeR2PublicBaseUrl('media.vertex.example/catalog/');

  assert.equal(mediaUrlForKey('user/audio.mp3'), '/api/r2-file/user/audio.mp3');
  assert.equal(
    canonicalizeManagedMediaUrl('https://media.vertex.example/catalog/user/audio.mp3', publicBaseUrl),
    '/api/r2-file/user/audio.mp3',
  );
  assert.equal(
    getManagedStorageKey('https://media.vertex.example/catalog/user/audio.mp3', publicBaseUrl),
    'user/audio.mp3',
  );
});

test('strict legacy private upload URLs migrate into the same bucket proxy', () => {
  const audio = '/api/r2-private/private/user_1/audio_123e4567-e89b-42d3-a456-426614174000.mp3';
  const image = '/api/r2-private/private/user_1/image_123e4567-e89b-42d3-a456-426614174001.webp';

  assert.equal(canonicalizeManagedMediaUrl(audio), audio.replace('/api/r2-private/', '/api/r2-file/'));
  assert.equal(canonicalizeManagedMediaUrl(image), image.replace('/api/r2-private/', '/api/r2-file/'));
  assert.equal(getManagedStorageKey(audio), 'private/user_1/audio_123e4567-e89b-42d3-a456-426614174000.mp3');
  assert.equal(canonicalizeManagedMediaUrl(`${audio}?download=1`), `${audio}?download=1`);
  assert.equal(canonicalizeManagedMediaUrl(audio.replace('/private/', '/public/')), audio.replace('/private/', '/public/'));
  assert.equal(canonicalizeManagedMediaUrl(audio.replace('.mp3', '.jpg')), audio.replace('.mp3', '.jpg'));
});

test('managed media key parsing rejects traversal and unrelated origins', () => {
  const publicBaseUrl = normalizeR2PublicBaseUrl('https://media.vertex.example');

  assert.equal(getManagedStorageKey('/api/r2-file/user/cover.jpg', publicBaseUrl), 'user/cover.jpg');
  assert.equal(getManagedStorageKey('/api/r2-file/user/%2e%2e/secret', publicBaseUrl), null);
  assert.equal(getManagedStorageKey('https://media.vertex.example/user/%2e%2e/secret', publicBaseUrl), null);
  assert.equal(getManagedStorageKey('https://other.example/user/cover.jpg', publicBaseUrl), null);
  assert.throws(() => normalizeR2PublicBaseUrl('http://media.vertex.example'), /valid HTTPS media origin/);
});
