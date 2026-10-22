const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.article.count();
  if (count > 0) {
    console.log(`seed skipped — articles already populated (${count} rows)`);
    return;
  }

  await prisma.article.createMany({
    data: [
      {
        title: 'Menjaga Kualitas Air Kolam Ikan Tawar',
        content:
          'Kualitas air adalah faktor utama kesehatan ikan. Pastikan suhu, pH, dan kadar ammonia tetap dalam batas ideal. Lakukan penggantian air 20-30% setiap minggu dan gunakan aerator untuk menjaga oksigen terlarut.',
        author: 'Tim Ifishy',
      },
      {
        title: 'Mengenal Aeromoniasis pada Ikan Nila',
        content:
          'Aeromoniasis adalah penyakit bakteri yang disebabkan oleh Aeromonas hydrophila. Gejalanya meliputi luka lecet di badan, sirip sobek, dan penurunan nafsu makan. Penanganan dilakukan dengan karantina ikan dan pengobatan antibiotik yang diresepkan.',
        author: 'Tim Ifishy',
      },
      {
        title: 'Pencegahan Penyakit Ikan Secara Berkala',
        content:
          'Pencegahan lebih baik daripada pengobatan. Karantina ikan baru, bersihkan alat yang dipakai antar kolam sebelum digunakan, dan hindari memberi pakan berlebihan. Scan berkala dengan Ifishy membantu deteksi dini penyakit.',
        author: 'Tim Ifishy',
      },
    ],
  });
  console.log('seed done: 3 articles inserted');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
