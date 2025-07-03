// routes/tagRoutes.js

const router = require('express').Router();
const tagController = require('../controllers/tagController');
const { authenticateJWT, requireRole } = require('../middleware/auth');

/**
 * @route   GET /api/tags
 * @desc    Get all available tags
 * @access  Public
 */
router.get('/', tagController.getAllTags);

/**
 * @route   POST /api/tags
 * @desc    Create a new tag
 * @access  Admin only
 */
router.post(
    '/',
    authenticateJWT,      // Must be logged in
    requireRole('admin'), // Must be an admin
    tagController.createTag
);

module.exports = router;