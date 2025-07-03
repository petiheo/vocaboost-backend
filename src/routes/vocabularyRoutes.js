// routes/vocabularyRoutes.js

const router = require('express').Router();
const vocabularyController = require('../controllers/vocabularyController');
const { authenticateJWT, optionalAuth } = require('../middleware/auth');
// We will add validators in the next step, so they are commented out for now.
// const { vocabularyValidators } = require('../middleware/validation/validators');

// =================================================================
// PUBLIC ROUTES (Authentication is optional)
// =================================================================

/**
 * @route   GET /api/vocabulary/lists/:id
 * @desc    Get a single vocabulary list by its ID
 * @access  Public (with checks in controller for private lists)
 */
router.get('/lists/:id', optionalAuth, vocabularyController.getListById);


// =================================================================
// PROTECTED ROUTES (User must be authenticated)
// =================================================================

router.use(authenticateJWT); // Apply authentication to all routes below this line

// --- List-related CRUD ---

/**
 * @route   POST /api/vocabulary/lists
 * @desc    Create a new vocabulary list
 * @access  Private (Authenticated users)
 */
router.post('/lists', vocabularyController.createList);

/**
 * @route   GET /api/vocabulary/my-lists
 * @desc    Get all lists created by the logged-in user
 * @access  Private (Authenticated users)
 */
router.get('/my-lists', vocabularyController.getMyLists);

/**
 * @route   PUT /api/vocabulary/lists/:id
 * @desc    Update a vocabulary list owned by the user
 * @access  Private (Owner only)
 */
router.put('/lists/:id', vocabularyController.updateList);

/**
 * @route   DELETE /api/vocabulary/lists/:id
 * @desc    Delete a vocabulary list owned by the user
 * @access  Private (Owner only)
 */
router.delete('/lists/:id', vocabularyController.deleteList);

// --- Word-related CRUD ---

/**
 * @route   POST /api/vocabulary/lists/:listId/words
 * @desc    Add a new word to a specific list
 * @access  Private (Owner of the list only)
 */
router.post('/lists/:listId/words', vocabularyController.addWordToList);

/**
 * @route   PUT /api/vocabulary/words/:wordId
 * @desc    Update a specific word
 * @access  Private (Owner of the list containing the word)
 */
router.put('/words/:wordId', vocabularyController.updateWord);

/**
 * @route   DELETE /api/vocabulary/words/:wordId
 * @desc    Delete a specific word
 * @access  Private (Owner of the list containing the word)
 */
router.delete('/words/:wordId', vocabularyController.deleteWord);


module.exports = router;