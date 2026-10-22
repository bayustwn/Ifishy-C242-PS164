const guard = (label, message, handler) =>
  async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error(`${label}:`, error);
      res.status(500).json({ success: false, message });
    }
  };

module.exports = guard;
