const { z } = require('zod');

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const parsePagination = (query) => {
  const parsed = paginationSchema.safeParse(query ?? {});
  return parsed.success ? parsed.data : {};
};

const sliceArgs = ({ limit, offset } = {}) => {
  const args = {};
  if (limit !== undefined) args.take = limit;
  if (offset !== undefined) args.skip = offset;
  return args;
};

module.exports = { paginationSchema, parsePagination, sliceArgs };
