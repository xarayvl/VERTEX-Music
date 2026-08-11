import assert from 'node:assert/strict';
import test from 'node:test';
import { HeadObjectCommand, ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';
import { auditSingleR2BucketReferences, probeSingleR2Bucket } from './r2Storage.js';

test('the R2 startup probe lists exactly the configured single bucket', async () => {
  let received: ListObjectsV2Command | null = null;
  const client = {
    send: async (command: ListObjectsV2Command) => {
      received = command;
      return { Contents: [{ Key: 'sample' }] };
    },
  } as unknown as S3Client;

  const result = await probeSingleR2Bucket(client, 'vertex-media');
  assert.ok(received instanceof ListObjectsV2Command);
  assert.deepEqual(received.input, { Bucket: 'vertex-media', MaxKeys: 1 });
  assert.deepEqual(result, { bucketName: 'vertex-media', sampledObjectCount: 1 });
});

test('the R2 startup probe fails loudly for a wrong bucket or token', async () => {
  const client = {
    send: async () => { throw Object.assign(new Error('forbidden'), { $metadata: { httpStatusCode: 403 } }); },
  } as unknown as S3Client;

  await assert.rejects(
    probeSingleR2Bucket(client, 'wrong-bucket'),
    /Cannot access the configured single R2 bucket "wrong-bucket"/,
  );
});

test('the reference audit checks Redis media keys only in the configured bucket', async () => {
  const received: Array<{ Bucket?: string; Key?: string }> = [];
  const client = {
    send: async (command: HeadObjectCommand) => {
      assert.ok(command instanceof HeadObjectCommand);
      received.push(command.input);
      if (command.input.Key === 'user/missing.jpg') {
        throw { name: 'NotFound', $metadata: { httpStatusCode: 404 } };
      }
      return {};
    },
  } as unknown as S3Client;

  const result = await auditSingleR2BucketReferences(
    client,
    'vertex-media',
    ['user/audio.mp3', 'user/missing.jpg', 'user/audio.mp3'],
  );

  assert.deepEqual(received, [
    { Bucket: 'vertex-media', Key: 'user/audio.mp3' },
    { Bucket: 'vertex-media', Key: 'user/missing.jpg' },
  ]);
  assert.deepEqual(result, {
    referencedObjectCount: 2,
    checkedObjectCount: 2,
    foundObjectCount: 1,
    missingObjectCount: 1,
    uncheckedObjectCount: 0,
    missingKeys: ['user/missing.jpg'],
  });
});

test('the reference audit rejects access errors instead of reporting a missing object', async () => {
  const client = {
    send: async () => {
      throw { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } };
    },
  } as unknown as S3Client;

  await assert.rejects(
    auditSingleR2BucketReferences(client, 'vertex-media', ['user/audio.mp3']),
    /Cannot verify media object "user\/audio.mp3" in the configured single R2 bucket "vertex-media"/,
  );
});
