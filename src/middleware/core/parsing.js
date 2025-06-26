const express = require('express');
const multer = require('multer');
const compression = require('compression');

const parsingMiddleware = () => [
  // Compression
  compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }),
  
  // Body parsing with size limits
  express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  }),
  express.urlencoded({ extended: true, limit: '10mb' }),
  
  // Request timeout
  (req, res, next) => {
    req.setTimeout(30000); // 30 seconds
    next();
  }
];

// File upload configuration
const fileUpload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'text/csv'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

module.exports = { parsingMiddleware, fileUpload };