const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { runGroqAnalysis } = require('../utils/groqAnalysis');
const { generateCVPdf } = require('../utils/cvGenerator');

const GENERATED_DIR = path.join(__dirname, '../generated');
if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });

// Helper: extract text from uploaded file
const extractText = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const buf = fs.readFileSync(filePath);
    const data = await pdfParse(buf);
    return data.text;
  }
  if (ext === '.doc' || ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  throw new Error('Unsupported file type.');
};

// @desc    Analyze & Optimize Resume, generate PDFs
// @route   POST /api/resume/optimize
const optimizeResume = async (req, res) => {
  const cleanup = () => {
    if (req.file && fs.existsSync(req.file.path)) fs.unlink(req.file.path, () => {});
  };
  try {
    const { jobDescription } = req.body;
    if (!req.file)       return res.status(400).json({ message: 'Please upload a resume file.' });
    if (!jobDescription) return res.status(400).json({ message: 'Please provide a job description.' });

    // 1. Extract text
    const resumeText = await extractText(req.file.path);
    if (!resumeText || resumeText.trim().length < 50) {
      cleanup();
      return res.status(400).json({ message: 'Could not extract enough text. Make sure the file is not scanned/image-only.' });
    }

    // 2. Run Groq AI analysis
    const result = await runGroqAnalysis(resumeText, jobDescription);

    // 3. Generate PDFs for each variant
    const timestamp = Date.now();
    const downloadLinks = [];

    for (let i = 0; i < (result.generated_variants || []).length; i++) {
      const variant = result.generated_variants[i];
      const filename = `cv_${timestamp}_variant${i + 1}_${variant.style_name.replace(/\s+/g, '_')}.pdf`;
      const outputPath = path.join(GENERATED_DIR, filename);
      await generateCVPdf(variant, outputPath);
      downloadLinks.push({
        style_name: variant.style_name,
        filename,
        url: `/api/resume/download/${filename}`,
      });
    }

    // Replace content field with download info
    result.download_links = downloadLinks;
    delete result.generated_variants; // don't send raw CV JSON to frontend

    cleanup();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    cleanup();
    console.error('[RESUME CONTROLLER ERROR]', error.message);
    return res.status(500).json({ message: 'Analysis failed.', error: error.message });
  }
};

// @desc    Download a generated CV PDF
// @route   GET /api/resume/download/:filename
const downloadCV = (req, res) => {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const filePath = path.join(GENERATED_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File not found or expired.' });
  }
  res.download(filePath, filename.replace(/_/g, ' '));
};

module.exports = { optimizeResume, downloadCV };
