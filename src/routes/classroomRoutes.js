const router = require('express').Router();
const classroomController = require('../controllers/classroomController');
const { requireRole, authenticateJWT, requireClassroomAccess } = require('../middleware/auth');
const { classroomValidators, handleValidationErrors } = require('../middleware/validation/validators');
const { body, param } = require('express-validator');

// Apply authentication to all routes
router.use(authenticateJWT);

// Teacher routes
router.post('/', 
  requireRole('teacher'),
  classroomValidators.create,
  classroomController.createClassroom
);

router.get('/my-classrooms', 
    requireRole('teacher'),
    classroomController.getMyClassrooms
);

router.post('/:classroomId/invite',
    requireRole('teacher'),
    classroomValidators.invite,
    classroomController.inviteStudents
);

router.delete('/:classroomId/students',
    requireRole('teacher'),
    [
        param('classroomId').isUUID(),
        body('studentIds').isArray().notEmpty(),
        handleValidationErrors
    ],
    classroomController.removeStudents
);

router.post('/:classroomId/assignments',
    requireRole('teacher'),
    [
        param('classroomId').isUUID(),
        body('title').notEmpty().trim(),
        body('assignmentType').isIn(['vocabulary', 'quiz', 'essay', 'speaking']),
        body('dueDate').optional().isISO8601(),
        handleValidationErrors
    ],
    classroomController.createAssignment
);

router.get('/:classroomId/analytics',
    requireRole('teacher'),
    [
        param('classroomId').isUUID(),
        handleValidationErrors
    ],
    classroomController.getClassroomAnalytics
);

// Student routes
router.post('/join',
    [
        body('classCode').notEmpty().trim().isLength({ min: 6, max: 6 }),
        handleValidationErrors
    ],
    classroomController.joinClassroom
);

router.get('/my-classes',
    classroomController.getMyClasses
);

router.get('/:classroomId',
  requireClassroomAccess,
  classroomController.getMyClassrooms
);

// Shared routes
router.get('/:classroomId/assignments',
    [
        param('classroomId').isUUID(),
        handleValidationErrors
    ],
    classroomController.getAssignments
);

module.exports = router;