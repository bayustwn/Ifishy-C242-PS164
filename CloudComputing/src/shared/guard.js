const logger = require('./logger');
const { fail } = require('./response');

const guard = (label, message, handler) =>
  async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      logger.error({ err: error }, label);
      fail(res, 500, 'INTERNAL_ERROR', message);
    }
  };

module.exports = guard;
