const router = require('express').Router();
const vocabularyController = require('../controllers/vocabularyController');
const { authenticateJWT, optionalAuth } = require('../middleware/auth');
const { vocabularyValidators } = require('../middleware/validation/validators');

// Public routes (optional auth for personalized data)
router.get('/', optionalAuth, vocabularyController.getLists);
router.get('/:id', optionalAuth, vocabularyController.getList);

// Protected routes
router.use(authenticateJWT); // Apply auth to all routes below

router.post('/', vocabularyValidators.createList, vocabularyController.createList);
router.put('/:id', vocabularyController.updateList);
router.delete('/:id', vocabularyController.deleteList);
router.post('/:listId/words', vocabularyController.addWord);

module.exports = router;