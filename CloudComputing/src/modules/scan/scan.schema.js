const { z } = require('zod');
const { UUID_PATTERN } = require('../../shared/id');

const saveScanSchema = z.object({
  imageKey: z
    .string({ message: 'Semua data harus diisi!' })
    .min(1, 'Semua data harus diisi!'),
  disease: z
    .string({ message: 'Semua data harus diisi!' })
    .min(1, 'Semua data harus diisi!'),
  confidence: z.coerce.number({ message: 'Confidence harus berupa angka desimal!' }),
  description: z
    .string({ message: 'Semua data harus diisi!' })
    .max(1000, 'Deskripsi terlalu panjang (maksimal 1000 karakter).'),
  treatment: z
    .string({ message: 'Semua data harus diisi!' })
    .max(1000, 'Langkah penanganan terlalu panjang (maksimal 1000 karakter).'),
  validation: z.string().max(1000, 'Validasi terlalu panjang (maksimal 1000 karakter).').optional(),
});

const scanUserIdSchema = z.object({
  userId: z.string().regex(UUID_PATTERN, 'User ID diperlukan!'),
});

module.exports = { saveScanSchema, scanUserIdSchema };
