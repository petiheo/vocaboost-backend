const { v4: uuidv4 } = require('uuid');

const requestId = (req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.set('X-Request-ID', req.id);
  next();
};

const requestContext = (req, res, next) => {
  req.context = {
    requestId: req.id,
    startTime: Date.now(),
    userId: req.user?.id,
    userRole: req.user?.role,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  };
  next();
};

module.exports = { requestId, requestContext };