const { randomUUID } = require('crypto');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { isUuid } = require('./id');

const MB = 1024 * 1024;
const UPLOAD_URL_TTL = 300;
const SIGNED_URL_TTL = 3600;

const PURPOSES = {
  avatar: {
    prefix: 'avatars',
    maxSize: 5 * MB,
    contentTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  post: {
    prefix: 'posts',
    maxSize: 10 * MB,
    contentTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  scan: {
    prefix: 'scans',
    maxSize: 15 * MB,
    contentTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
};

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const startsWithBytes = (bytes, expected) =>
  bytes.length >= expected.length && expected.every((value, index) => bytes[index] === value);

const hasValidSignature = (bytes, contentType) => {
  const data = Buffer.from(bytes);
  if (contentType === 'image/jpeg') return startsWithBytes(data, [0xFF, 0xD8, 0xFF]);
  if (contentType === 'image/png') {
    return startsWithBytes(data, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  }
  if (contentType === 'image/webp') {
    return data.length >= 12 && data.toString('latin1', 0, 4) === 'RIFF'
      && data.toString('latin1', 8, 12) === 'WEBP';
  }
  return false;
};

let client = null;

const CONFIG_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_PUBLIC',
  'R2_PUBLIC_BASE_URL',
];

const isConfigured = () => CONFIG_KEYS.every((key) => Boolean(process.env[key] && String(process.env[key]).trim()));

const required = (name) => {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`R2 is not configured: missing ${name}`);
  }
  return value;
};

const privateScanBucket = () => {
  const value = process.env.R2_BUCKET_PRIVATE;
  return value && String(value).trim() ? value : null;
};

const bucketFor = (purpose) => {
  if (purpose === 'scan') {
    const bucket = privateScanBucket();
    if (bucket) return bucket;
  }
  return required('R2_BUCKET_PUBLIC');
};

const purposeForPrefix = (prefix) => {
  const name = String(prefix).split('/')[0];
  return Object.keys(PURPOSES).find((purpose) => PURPOSES[purpose].prefix === name) ?? null;
};

const getClient = () => {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required('R2_ACCESS_KEY_ID'),
        secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
  return client;
};

const getPurpose = (purpose) => PURPOSES[purpose] ?? null;

const buildKey = (purpose, userId, contentType) => {
  const policy = PURPOSES[purpose];
  if (!policy || !EXTENSIONS[contentType]) throw new Error(`Unsupported upload type: ${contentType}`);
  const id = String(userId).toLowerCase();
  if (!isUuid(id)) throw new Error('Invalid user ID');
  return `${policy.prefix}/${id}/${randomUUID()}.${EXTENSIONS[contentType]}`;
};

const parseKey = (key) => {
  if (typeof key !== 'string') return null;
  const match = /^(avatars|posts|scans)\/([0-9a-f-]{36})\/([A-Za-z0-9-]+)\.([a-z0-9]+)$/i.exec(key);
  if (!match || !isUuid(match[2])) return null;
  const purpose = Object.keys(PURPOSES).find((name) => PURPOSES[name].prefix === match[1]);
  if (!purpose) return null;
  return { purpose, userId: match[2].toLowerCase(), filename: match[3], ext: match[4] };
};

const isOwnedKey = (key, purpose, userId) => {
  const parsed = parseKey(key);
  return Boolean(parsed) && parsed.purpose === purpose && parsed.userId === String(userId).toLowerCase();
};

const publicUrl = (value) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const base = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  return base ? `${base}/${value}` : value;
};

const presignUpload = async ({ purpose, contentType, userId }) => {
  const key = buildKey(purpose, userId, contentType);
  const command = new PutObjectCommand({
    Bucket: bucketFor(purpose),
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: UPLOAD_URL_TTL });
  return {
    key,
    uploadUrl,
    expiresIn: UPLOAD_URL_TTL,
    headers: { 'Content-Type': contentType },
  };
};

const deleteObject = async (key) => {
  const parsed = parseKey(key);
  if (!parsed) throw new Error('Invalid upload key');
  await getClient().send(new DeleteObjectCommand({ Bucket: bucketFor(parsed.purpose), Key: key }));
};

const verifyUpload = async (key) => {
  const parsed = parseKey(key);
  if (!parsed) throw Object.assign(new Error('Invalid upload key'), { code: 'INVALID_KEY' });
  const policy = PURPOSES[parsed.purpose];
  const bucket = bucketFor(parsed.purpose);
  const head = await getClient().send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  );
  const size = Number(head.ContentLength);
  const contentType = head.ContentType;
  const valid = policy.contentTypes.includes(contentType)
    && Number.isFinite(size)
    && size > 0
    && size <= policy.maxSize;
  if (!valid) {
    await deleteObject(key).catch(() => {});
    throw Object.assign(
      new Error('Uploaded file does not match the allowed type or size'),
      { code: 'INVALID_UPLOAD' },
    );
  }

  const object = await getClient().send(
    new GetObjectCommand({ Bucket: bucket, Key: key, Range: 'bytes=0-11' }),
  );
  const bytes = await object.Body.transformToByteArray();
  if (!hasValidSignature(bytes, contentType)) {
    await deleteObject(key).catch(() => {});
    throw Object.assign(
      new Error('Uploaded file does not match the allowed type or size'),
      { code: 'INVALID_UPLOAD' },
    );
  }

  return { ...parsed, size, contentType };
};

const uploadObject = async ({ key, body, contentType, cacheControl }) => {
  const parsed = parseKey(key);
  if (!parsed) throw new Error('Invalid upload key');
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucketFor(parsed.purpose),
      Key: key,
      Body: body,
      ContentType: contentType,
      ...(cacheControl ? { CacheControl: cacheControl } : {}),
    }),
  );
  return key;
};

const deleteOwned = async (key, purpose, userId) => {
  if (!isOwnedKey(key, purpose, userId)) return false;
  await deleteObject(key);
  return true;
};

const listObjects = async (prefix) => {
  const bucket = bucketFor(purposeForPrefix(prefix));
  const objects = [];
  let continuationToken;

  do {
    const listed = await getClient().send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }),
    );
    for (const entry of listed.Contents || []) {
      if (entry.Key) {
        objects.push({
          key: entry.Key,
          size: Number(entry.Size ?? 0),
          lastModified: entry.LastModified,
        });
      }
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
};

const deleteKeys = async (keys) => {
  const groups = new Map();
  for (const key of keys) {
    const parsed = parseKey(key);
    const bucket = bucketFor(parsed?.purpose ?? null);
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket).push(key);
  }

  let deleted = 0;
  for (const [bucket, bucketKeys] of groups) {
    for (let start = 0; start < bucketKeys.length; start += 1000) {
      const batch = bucketKeys.slice(start, start + 1000);
      if (!batch.length) continue;
      await getClient().send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      deleted += batch.length;
    }
  }
  return deleted;
};

const deletePrefix = async (prefix) => {
  const bucket = bucketFor(purposeForPrefix(prefix));
  let continuationToken;
  let deleted = 0;

  do {
    const listed = await getClient().send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }),
    );
    const keys = (listed.Contents || []).map((entry) => entry.Key).filter(Boolean);
    for (let start = 0; start < keys.length; start += 1000) {
      await getClient().send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.slice(start, start + 1000).map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
    deleted += keys.length;
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
};

const deleteUserObjects = async (userId) => {
  const id = String(userId).toLowerCase();
  if (!isUuid(id)) return 0;
  let deleted = 0;
  for (const prefix of ['avatars', 'posts', 'scans']) {
    deleted += await deletePrefix(`${prefix}/${id}/`);
  }
  return deleted;
};

const resolveMediaUrl = async (value) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const parsed = parseKey(value);
  if (!parsed) return value;
  if (parsed.purpose === 'scan' && privateScanBucket()) {
    const command = new GetObjectCommand({ Bucket: privateScanBucket(), Key: value });
    return getSignedUrl(getClient(), command, { expiresIn: SIGNED_URL_TTL });
  }
  return publicUrl(value);
};

module.exports = {
  PURPOSES,
  isConfigured,
  isScanPrivate: () => Boolean(privateScanBucket()),
  getPurpose,
  buildKey,
  parseKey,
  isOwnedKey,
  publicUrl,
  presignUpload,
  verifyUpload,
  uploadObject,
  listObjects,
  deleteObject,
  deleteKeys,
  deleteOwned,
  deleteUserObjects,
  hasValidSignature,
  resolveMediaUrl,
};
