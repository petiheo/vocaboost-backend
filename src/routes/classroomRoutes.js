const router = require('express').Router();
const classroomController = require('../controllers/classroomController');
const { authenticateJWT, requireRole } = require('../middleware/authMiddleware');
const { body, param } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validators');

// Apply authentication to all routes
router.use(authenticateJWT);

// Teacher routes
router.post('/', 
    requireRole('teacher'),
    [
        body('name').notEmpty().trim(),
        body('gradeLevel').optional().isInt({ min: 1, max: 12 }),
        body('maxStudents').optional().isInt({ min: 1, max: 100 }),
        handleValidationErrors
    ],
    classroomController.createClassroom
);

router.get('/my-classrooms', 
    requireRole('teacher'),
    classroomController.getMyClassrooms
);

router.post('/:classroomId/invite',
    requireRole('teacher'),
    [
        param('classroomId').isUUID(),
        body('emails').isArray().notEmpty(),
        body('emails.*').isEmail(),
        handleValidationErrors
    ],
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
    [
        param('classroomId').isUUID(),
        handleValidationErrors
    ],
    classroomController.getClassroomDetails
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