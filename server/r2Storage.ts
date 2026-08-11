import { HeadObjectCommand, ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';

const DEFAULT_REFERENCE_AUDIT_LIMIT = 64;
const REFERENCE_AUDIT_CONCURRENCY = 8;

export type R2BucketProbe = {
  bucketName: string;
  sampledObjectCount: number;
};

export type R2ReferenceAudit = {
  referencedObjectCount: number;
  checkedObjectCount: number;
  foundObjectCount: number;
  missingObjectCount: number;
  uncheckedObjectCount: number;
  missingKeys: string[];
};

/**
 * Verify the exact bucket used by upload, verification, reads, and deletion.
 * Cloudflare R2 Object Read & Write tokens include object-list permission, so
 * this catches a wrong account, bucket name, credential, or token scope.
 */
export async function probeSingleR2Bucket(client: S3Client, bucketName: string): Promise<R2BucketProbe> {
  const bucket = bucketName.trim();
  if (!bucket) throw new Error('R2_BUCKET_NAME is required.');

  try {
    const result = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
    return {
      bucketName: bucket,
      sampledObjectCount: Array.isArray(result.Contents) ? result.Contents.length : 0,
    };
  } catch (cause) {
    throw new Error(
      `Cannot access the configured single R2 bucket "${bucket}". Verify R2_ACCOUNT_ID, R2_BUCKET_NAME, and that the R2 token has Object Read & Write access to this bucket.`,
      { cause },
    );
  }
}

function isMissingObject(error: unknown): boolean {
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
  return candidate?.name === 'NotFound'
    || candidate?.name === 'NoSuchKey'
    || candidate?.$metadata?.httpStatusCode === 404;
}

/**
 * Cross-check Redis media references against the selected bucket. An account
 * can have access to several buckets, so ListObjects alone cannot prove that
 * R2_BUCKET_NAME points at the bucket that owns the application's media.
 */
export async function auditSingleR2BucketReferences(
  client: S3Client,
  bucketName: string,
  storageKeys: Iterable<string>,
  limit = DEFAULT_REFERENCE_AUDIT_LIMIT,
): Promise<R2ReferenceAudit> {
  const bucket = bucketName.trim();
  if (!bucket) throw new Error('R2_BUCKET_NAME is required.');

  const keys = Array.from(new Set(Array.from(storageKeys, (key) => key.trim()).filter(Boolean))).sort();
  const checkedKeys = keys.slice(0, Math.max(0, limit));
  const missingKeys: string[] = [];
  let foundObjectCount = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < checkedKeys.length) {
      const key = checkedKeys[cursor++];
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        foundObjectCount += 1;
      } catch (error) {
        if (isMissingObject(error)) {
          missingKeys.push(key);
          continue;
        }
        throw new Error(
          `Cannot verify media object "${key}" in the configured single R2 bucket "${bucket}".`,
          { cause: error },
        );
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(REFERENCE_AUDIT_CONCURRENCY, checkedKeys.length) }, () => worker()),
  );

  missingKeys.sort();
  return {
    referencedObjectCount: keys.length,
    checkedObjectCount: checkedKeys.length,
    foundObjectCount,
    missingObjectCount: missingKeys.length,
    uncheckedObjectCount: keys.length - checkedKeys.length,
    missingKeys,
  };
}
