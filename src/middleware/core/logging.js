const morgan = require('morgan');
const logger = require('../../utils/logger');

const requestLogger = morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
});

const auditLogger = (req, res, next) => {
  if (req.user) {
    logger.info({
      type: 'user_action',
      userId: req.user.id,
      action: `${req.method} ${req.path}`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  }
  next();
};

module.exports = { requestLogger, auditLogger, logger };