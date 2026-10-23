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

const MB = 1024 * 1024;
const UPLOAD_URL_TTL = 300;

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
  return `${policy.prefix}/${Number(userId)}/${randomUUID()}.${EXTENSIONS[contentType]}`;
};

const parseKey = (key) => {
  if (typeof key !== 'string') return null;
  const match = /^(avatars|posts|scans)\/(\d+)\/([A-Za-z0-9-]+)\.([a-z0-9]+)$/.exec(key);
  if (!match) return null;
  const purpose = Object.keys(PURPOSES).find((name) => PURPOSES[name].prefix === match[1]);
  if (!purpose) return null;
  return { purpose, userId: Number(match[2]), filename: match[3], ext: match[4] };
};

const isOwnedKey = (key, purpose, userId) => {
  const parsed = parseKey(key);
  return Boolean(parsed) && parsed.purpose === purpose && parsed.userId === Number(userId);
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
    Bucket: required('R2_BUCKET_PUBLIC'),
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
  if (!parseKey(key)) throw new Error('Invalid upload key');
  await getClient().send(new DeleteObjectCommand({ Bucket: required('R2_BUCKET_PUBLIC'), Key: key }));
};

const verifyUpload = async (key) => {
  const parsed = parseKey(key);
  if (!parsed) throw Object.assign(new Error('Invalid upload key'), { code: 'INVALID_KEY' });
  const policy = PURPOSES[parsed.purpose];
  const head = await getClient().send(
    new HeadObjectCommand({ Bucket: required('R2_BUCKET_PUBLIC'), Key: key }),
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
    new GetObjectCommand({ Bucket: required('R2_BUCKET_PUBLIC'), Key: key, Range: 'bytes=0-11' }),
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
  if (!parseKey(key)) throw new Error('Invalid upload key');
  await getClient().send(
    new PutObjectCommand({
      Bucket: required('R2_BUCKET_PUBLIC'),
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

const deletePrefix = async (prefix) => {
  const bucket = required('R2_BUCKET_PUBLIC');
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
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return 0;
  let deleted = 0;
  for (const prefix of ['avatars', 'posts', 'scans']) {
    deleted += await deletePrefix(`${prefix}/${id}/`);
  }
  return deleted;
};

const resolveMediaUrl = (value) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return parseKey(value) ? publicUrl(value) : value;
};

module.exports = {
  PURPOSES,
  isConfigured,
  getPurpose,
  buildKey,
  parseKey,
  isOwnedKey,
  publicUrl,
  presignUpload,
  verifyUpload,
  uploadObject,
  deleteObject,
  deleteOwned,
  deleteUserObjects,
  hasValidSignature,
  resolveMediaUrl,
};
