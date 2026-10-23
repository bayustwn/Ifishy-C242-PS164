const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const prisma = require('../src/shared/prisma');
const r2 = require('../src/shared/r2');

const SOURCE_ARG = process.argv.find((arg) => arg.startsWith('--source='));
const UPLOADS_DIR = path.resolve(
  SOURCE_ARG ? SOURCE_ARG.slice('--source='.length) : path.join(__dirname, '..', 'uploads'),
);
const APPLY = process.argv.includes('--apply');
const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const legacyRelativePath = (value) => {
  if (typeof value !== 'string') return null;
  const match = /\/uploads\/(.+)$/.exec(value);
  if (match) return decodeURIComponent(match[1]);
  if (value.startsWith('uploads/')) return decodeURIComponent(value.slice('uploads/'.length));
  return null;
};

const localFilePath = (relative) => {
  const resolved = path.resolve(UPLOADS_DIR, relative);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) return null;
  return resolved;
};

const plan = async (label, rows, { field, purpose, owner, update }) => {
  const stats = { migrated: 0, missing: 0, invalid: 0, skipped: 0, failed: 0 };

  for (const row of rows) {
    const value = row[field];
    const relative = legacyRelativePath(value);
    if (!relative) {
      stats.skipped += 1;
      continue;
    }

    const filePath = localFilePath(relative);
    if (!filePath || !fs.existsSync(filePath)) {
      stats.missing += 1;
      console.log(`[${label}] HILANG  ${relative}`);
      continue;
    }

    const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()];
    const body = fs.readFileSync(filePath);
    if (!contentType || !r2.hasValidSignature(body, contentType)) {
      stats.invalid += 1;
      console.log(`[${label}] INVALID ${relative}`);
      continue;
    }

    const userId = owner(row);
    const key = r2.buildKey(purpose, userId, contentType);
    console.log(`[${label}] ${APPLY ? 'UPLOAD ' : 'RENCANA'} ${relative} -> ${key}`);

    if (!APPLY) {
      stats.migrated += 1;
      continue;
    }

    try {
      await r2.uploadObject({
        key,
        body,
        contentType,
        cacheControl: 'public, max-age=31536000, immutable',
      });
      await update(row, key);
      stats.migrated += 1;
    } catch (error) {
      stats.failed += 1;
      console.error(`[${label}] GAGAL   ${relative}: ${error.message}`);
    }
  }

  return stats;
};

const main = async () => {
  if (!r2.isConfigured()) {
    throw new Error('R2 belum dikonfigurasi di .env');
  }

  const users = await prisma.user.findMany({
    where: { profilePhoto: { not: null } },
    select: { id: true, profilePhoto: true },
  });
  const posts = await prisma.post.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, userId: true, imageUrl: true },
  });
  const scans = await prisma.scanHistory.findMany({
    select: { id: true, userId: true, fishImage: true },
  });

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} (tambahkan --apply untuk menulis)`);

  const results = [
    ['avatar', await plan('avatar', users, {
      field: 'profilePhoto',
      purpose: 'avatar',
      owner: (row) => row.id,
      update: (row, key) => prisma.user.update({ where: { id: row.id }, data: { profilePhoto: key } }),
    })],
    ['post', await plan('post', posts, {
      field: 'imageUrl',
      purpose: 'post',
      owner: (row) => row.userId,
      update: (row, key) => prisma.post.update({ where: { id: row.id }, data: { imageUrl: key } }),
    })],
    ['scan', await plan('scan', scans, {
      field: 'fishImage',
      purpose: 'scan',
      owner: (row) => row.userId,
      update: (row, key) => prisma.scanHistory.update({ where: { id: row.id }, data: { fishImage: key } }),
    })],
  ];

  console.log('\nRingkasan:');
  let failed = 0;
  for (const [label, stats] of results) {
    failed += stats.failed;
    console.log(`${label}: ${stats.migrated} ${APPLY ? 'dimigrasi' : 'siap'}, ${stats.missing} hilang, ${stats.invalid} invalid, ${stats.skipped} dilewati, ${stats.failed} gagal`);
  }

  if (failed > 0) process.exitCode = 1;
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
