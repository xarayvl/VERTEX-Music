import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canServeR2MediaDirectly,
  canonicalizeLegacyR2DevMediaUrl,
  getManagedStorageKey,
  mediaUrlForKey,
  normalizeR2PublicBaseUrl,
} from './r2Media.js';

test('r2.dev media stays on the authenticated same-origin proxy', () => {
  const publicBaseUrl = normalizeR2PublicBaseUrl('https://pub-example.r2.dev');

  assert.equal(canServeR2MediaDirectly(publicBaseUrl), false);
  assert.equal(mediaUrlForKey('user/audio file.mp3', publicBaseUrl), '/api/r2-file/user/audio%20file.mp3');
  assert.equal(
    canonicalizeLegacyR2DevMediaUrl('https://pub-example.r2.dev/user/cover%20art.jpg'),
    '/api/r2-file/user/cover%20art.jpg',
  );
});

test('a configured custom R2 domain can serve immutable media directly', () => {
  const publicBaseUrl = normalizeR2PublicBaseUrl('media.vertex.example/catalog/');

  assert.equal(canServeR2MediaDirectly(publicBaseUrl), true);
  assert.equal(mediaUrlForKey('user/audio.mp3', publicBaseUrl), 'https://media.vertex.example/catalog/user/audio.mp3');
  assert.equal(
    getManagedStorageKey('https://media.vertex.example/catalog/user/audio.mp3', publicBaseUrl),
    'user/audio.mp3',
  );
});

test('managed media key parsing rejects traversal and unrelated origins', () => {
  const publicBaseUrl = normalizeR2PublicBaseUrl('https://media.vertex.example');

  assert.equal(getManagedStorageKey('/api/r2-file/user/cover.jpg', publicBaseUrl), 'user/cover.jpg');
  assert.equal(getManagedStorageKey('/api/r2-file/user/%2e%2e/secret', publicBaseUrl), null);
  assert.equal(getManagedStorageKey('https://media.vertex.example/user/%2e%2e/secret', publicBaseUrl), null);
  assert.equal(getManagedStorageKey('https://other.example/user/cover.jpg', publicBaseUrl), null);
  assert.throws(() => normalizeR2PublicBaseUrl('http://media.vertex.example'), /valid HTTPS media origin/);
});
