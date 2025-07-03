// controllers/tagController.js

const Tag = require('../models/Tag'); // Import the Tag Model

class TagController {

    /**
     * Handles GET /api/tags
     * Gets all available tags for users to select from when creating/editing a list.
     */
    async getAllTags(req, res, next) {
        try {
            const tags = await Tag.getAll();
            res.json({ success: true, data: tags });
        } catch (error) {
            next(error); // Pass errors to the global error handler
        }
    }

    /**
     * Handles POST /api/tags
     * Creates a new tag. This route should be protected by admin-only middleware.
     */
    async createTag(req, res, next) {
        try {
            const { name } = req.body;
            if (!name) {
                return res.status(400).json({ success: false, error: 'Tag name is required.' });
            }

            const newTag = await Tag.create(name);
            res.status(201).json({ success: true, data: newTag });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new TagController();