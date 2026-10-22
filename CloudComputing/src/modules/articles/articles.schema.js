const { z } = require('zod');

const scrapeParamsSchema = z.object({
  url: z.string().optional(),
});

module.exports = { scrapeParamsSchema };
