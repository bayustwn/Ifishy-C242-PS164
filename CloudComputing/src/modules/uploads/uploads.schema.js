const { z } = require('zod');
const { PURPOSES } = require('../../shared/r2');

const presignSchema = z
  .object({
    purpose: z.enum(Object.keys(PURPOSES)),
    contentType: z.string({ required_error: 'contentType is required' }).min(1, 'contentType is required'),
    size: z.coerce
      .number({ required_error: 'size is required' })
      .int()
      .positive({ message: 'size must be a positive number of bytes' }),
  })
  .superRefine((data, ctx) => {
    const policy = PURPOSES[data.purpose];
    if (!policy.contentTypes.includes(data.contentType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentType'],
        message: `contentType must be one of: ${policy.contentTypes.join(', ')}`,
      });
    }
    if (data.size > policy.maxSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['size'],
        message: `size must not exceed ${Math.floor(policy.maxSize / (1024 * 1024))} MB`,
      });
    }
  });

const keyBodySchema = z.object({
  key: z.string({ required_error: 'key is required' }).min(1, 'key is required'),
});

module.exports = { presignSchema, keyBodySchema };
