const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const resourceController = require('../controllers/resourceController');

const router = express.Router();

router.use(protect, authorize('society'));

router.post('/', resourceController.createResource);
router.get('/', resourceController.getResources);
router.get('/:id', resourceController.getResourceById);
router.put('/:id', resourceController.updateResource);
router.delete('/:id', resourceController.deleteResource);

module.exports = router;
