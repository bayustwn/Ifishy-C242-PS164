const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const prisma = require('../src/shared/prisma');
const r2 = require('../src/shared/r2');

const HOURS_ARG = process.argv.find((arg) => arg.startsWith('--older-than-hours='));
const APPLY = process.argv.includes('--apply');
const HOURS = HOURS_ARG ? Number(HOURS_ARG.slice('--older-than-hours='.length)) : 24;

const collectReferencedKeys = async () => {
  const [users, posts, scans] = await Promise.all([
    prisma.user.findMany({ select: { profilePhoto: true } }),
    prisma.post.findMany({ select: { imageUrl: true } }),
    prisma.scanHistory.findMany({ select: { fishImage: true } }),
  ]);

  const referenced = new Set();
  const add = (value) => {
    if (typeof value === 'string' && r2.parseKey(value)) referenced.add(value);
  };
  users.forEach((row) => add(row.profilePhoto));
  posts.forEach((row) => add(row.imageUrl));
  scans.forEach((row) => add(row.fishImage));
  return referenced;
};

const main = async () => {
  if (!Number.isFinite(HOURS) || HOURS <= 0) {
    throw new Error('--older-than-hours must be a positive number');
  }
  if (!r2.isConfigured()) {
    throw new Error('R2 is not configured');
  }

  const referenced = await collectReferencedKeys();
  const objects = [];
  for (const prefix of ['avatars/', 'posts/', 'scans/']) {
    objects.push(...(await r2.listObjects(prefix)));
  }

  const cutoff = Date.now() - HOURS * 60 * 60 * 1000;
  const orphans = objects.filter(
    (object) => !referenced.has(object.key)
      && object.lastModified instanceof Date
      && object.lastModified.getTime() < cutoff,
  );

  const byPrefix = orphans.reduce((acc, object) => {
    const prefix = object.key.split('/')[0];
    acc[prefix] = (acc[prefix] || 0) + 1;
    return acc;
  }, {});

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} | batas umur: ${HOURS} jam`);
  console.log(`Objek R2: ${objects.length} | direferensikan: ${referenced.size} | orphan: ${orphans.length}`);
  console.log('Orphan per prefix:', JSON.stringify(byPrefix));
  for (const object of orphans.slice(0, 20)) {
    console.log(`  ${object.key} (${object.lastModified.toISOString()}, ${object.size} B)`);
  }
  if (orphans.length > 20) console.log(`  ... dan ${orphans.length - 20} lainnya`);

  if (APPLY && orphans.length > 0) {
    const deleted = await r2.deleteKeys(orphans.map((object) => object.key));
    console.log(`Dihapus: ${deleted}`);
  } else if (orphans.length > 0) {
    console.log('Jalankan dengan --apply untuk menghapus.');
  }
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
