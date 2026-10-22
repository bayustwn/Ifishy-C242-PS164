const ok = (res, data = null, message, status = 200) => {
  const body = { success: true, data };
  if (message) body.message = message;
  return res.status(status).json(body);
};

const fail = (res, status, code, message) => res.status(status).json({
  success: false,
  error: { code, message },
});

module.exports = { ok, fail };
