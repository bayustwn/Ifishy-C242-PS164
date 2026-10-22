const logger = require('./logger');

const guard = (label, message, handler) =>
  async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      logger.error({ err: error }, label);
      res.status(500).json({ success: false, message });
    }
  };

module.exports = guard;
