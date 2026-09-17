const express = require('express');
const authenticate = require('../middleware/auth');
const { createSummary, getSummaries } = require('../controllers/summaryController');

const router = express.Router();

router.post('/', authenticate, createSummary);
router.get('/', authenticate, getSummaries);

module.exports = router;
