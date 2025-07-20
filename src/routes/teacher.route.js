const express = require('express');
const teacherRouter = express.Router();
const teacherController = require('../controllers/teacher.controller');
const { authMiddleware, requireRole, requireEmailVerified } = require('../middlewares/auth.middleware');
const { uploadCredentials } = require('../middlewares/upload.middleware');
const { teacherValidators } = require('../validators/teacher.validator');

// User routes - Submit and check verification
teacherRouter.post(
  '/verification/submit',
  authMiddleware,
  requireEmailVerified,
  uploadCredentials,
  teacherValidators.submitVerification,
  teacherController.submitVerification
);

teacherRouter.get(
  '/verification/status',
  authMiddleware,
  teacherController.getVerificationStatus
);

// Admin routes - Review verification requests
teacherRouter.get(
  '/verification/requests/pending',
  authMiddleware,
  requireRole('admin'),
  teacherController.getPendingRequests
);

teacherRouter.get(
  '/verification/requests',
  authMiddleware,
  requireRole('admin'),
  teacherController.getAllRequests
);

teacherRouter.put(
  '/verification/requests/:requestId/approve',
  authMiddleware,
  requireRole('admin'),
  teacherController.approveRequest
);

teacherRouter.put(
  '/verification/requests/:requestId/reject',
  authMiddleware,
  requireRole('admin'),
  teacherValidators.rejectRequest,
  teacherController.rejectRequest
);

module.exports = teacherRouter;