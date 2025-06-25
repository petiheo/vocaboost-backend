// routes/index.js
const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./auth');
const vocabularyRoutes = require('./vocabulary');
const reviewRoutes = require('./review');
const classroomRoutes = require('./classroom');
const adminRoutes = require('./admin');
const statisticsRoutes = require('./statistics');
const userRoutes = require('./user');

// Apply routes với versioning
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/vocabulary', vocabularyRoutes);
router.use('/api/v1/reviews', reviewRoutes);
router.use('/api/v1/classrooms', classroomRoutes);
router.use('/api/v1/admin', adminRoutes);
router.use('/api/v1/statistics', statisticsRoutes);
router.use('/api/v1/users', userRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

module.exports = router;

// routes/review.js
const express = require('express');
const router = express.Router();
const { ReviewController, validateReviewSubmission } = require('../controllers/ReviewController');
const { authenticate, authorize } = require('../middleware/auth');
const { reviewLimiter } = require('../middleware/rateLimiter');

const reviewController = new ReviewController();

// USC4-7: Review routes với rate limiting
router.get('/queue', 
  authenticate,
  reviewController.getReviewQueue.bind(reviewController)
);

router.post('/submit',
  authenticate,
  reviewLimiter,
  validateReviewSubmission,
  reviewController.submitReview.bind(reviewController)
);

router.get('/progress',
  authenticate,
  reviewController.getStudyProgress.bind(reviewController)
);

router.post('/daily-goal',
  authenticate,
  reviewController.setDailyGoal.bind(reviewController)
);

module.exports = router;

// routes/classroom.js
const express = require('express');
const router = express.Router();
const { ClassroomController, validateClassroom, validateAssignment } = require('../controllers/ClassroomController');
const { authenticate, authorize } = require('../middleware/auth');
const { apiLimiter, emailLimiter } = require('../middleware/rateLimiter');

const classroomController = new ClassroomController();

// Teacher routes
router.post('/',
  authenticate,
  authorize(['teacher', 'admin']),
  apiLimiter,
  validateClassroom,
  classroomController.createClassroom.bind(classroomController)
);

router.get('/my-classrooms',
  authenticate,
  authorize(['teacher', 'admin']),
  classroomController.getMyClassrooms.bind(classroomController)
);

router.post('/:classroomId/invite',
  authenticate,
  authorize(['teacher', 'admin']),
  emailLimiter,
  classroomController.inviteStudents.bind(classroomController)
);

router.post('/:classroomId/assignments',
  authenticate,
  authorize(['teacher', 'admin']),
  validateAssignment,
  classroomController.createAssignment.bind(classroomController)
);

router.get('/:classroomId/progress',
  authenticate,
  authorize(['teacher', 'admin']),
  classroomController.getStudentProgress.bind(classroomController)
);

// Student routes
router.post('/join',
  authenticate,
  classroomController.joinClassroom.bind(classroomController)
);

module.exports = router;

// routes/admin.js
const express = require('express');
const router = express.Router();
const { AdminController, validateUserUpdate, validateBulkUpdate } = require('../controllers/AdminController');
const { authenticate, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

const adminController = new AdminController();

// USC18-21: Admin routes với strict authorization
router.get('/users',
  authenticate,
  authorize(['admin']),
  adminController.getUsersManagement.bind(adminController)
);

router.put('/users/:userId',
  authenticate,
  authorize(['admin']),
  validateUserUpdate,
  adminController.updateUser.bind(adminController)
);

router.get('/system/health',
  authenticate,
  authorize(['admin']),
  adminController.getSystemHealth.bind(adminController)
);

router.get('/analytics',
  authenticate,
  authorize(['admin']),
  adminController.getSystemAnalytics.bind(adminController)
);

router.post('/users/bulk-update',
  authenticate,
  authorize(['admin']),
  validateBulkUpdate,
  adminController.bulkUpdateUsers.bind(adminController)
);

router.post('/users/deactivate',
  authenticate,
  authorize(['admin']),
  adminController.deactivateUsers.bind(adminController)
);

module.exports = router;