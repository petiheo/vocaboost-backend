const performanceMonitor = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log slow requests (> 1 second)
    if (duration > 1000) {
      console.warn({
        type: 'slow_request',
        duration: `${duration}ms`,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        requestId: req.id
      });
    }
  });
  
  next();
};

module.exports = { performanceMonitor };