const { z } = require('zod');

const DEFAULT_LIMIT = 10;

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const parsePagination = (query) => {
  const parsed = paginationSchema.safeParse(query ?? {});
  const data = parsed.success ? parsed.data : {};
  return {
    limit: data.limit ?? DEFAULT_LIMIT,
    offset: data.offset ?? 0,
  };
};

const sliceArgs = ({ limit = DEFAULT_LIMIT, offset = 0 } = {}) => {
  const args = { take: limit };
  if (offset > 0) args.skip = offset;
  return args;
};

module.exports = { DEFAULT_LIMIT, paginationSchema, parsePagination, sliceArgs };
