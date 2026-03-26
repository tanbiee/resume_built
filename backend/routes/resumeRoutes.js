const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { optimizeResume, downloadCV } = require('../controllers/resumeController');

// POST /api/resume/optimize — upload resume + JD, get ATS analysis + PDF download links
router.post('/optimize', upload.single('resume'), optimizeResume);

// GET /api/resume/download/:filename — download a generated CV PDF
router.get('/download/:filename', downloadCV);

module.exports = router;
