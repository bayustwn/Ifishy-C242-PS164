const { z } = require('zod');

const scrapeParamsSchema = z.object({
  url: z.string().max(2048).optional(),
});

module.exports = { scrapeParamsSchema };
