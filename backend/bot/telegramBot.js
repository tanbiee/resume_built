require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const https = require('https');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { runGroqAnalysis } = require('../utils/groqAnalysis');
const { generateCVPdf } = require('../utils/cvGenerator');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set in .env');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// Suppress non-fatal 409 Conflict errors (caused by running multiple instances)
bot.on('polling_error', (err) => {
  if (err.code === 'ETELEGRAM' && err.message.includes('409')) {
    console.warn('⚠️  Telegram 409: Another bot instance is already running. Stop duplicate npm run dev processes.');
  } else {
    console.error('[BOT POLLING ERROR]', err.message);
  }
});


// ── In-memory session store (per chat_id) ──────────────────────────────────────
const sessions = {};
const getSession = (id) => sessions[id] || (sessions[id] = { step: 'idle' });

// ── Helpers ────────────────────────────────────────────────────────────────────
const tmpDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

/** Download a Telegram file to disk, return local file path */
const downloadFile = (fileId, ext) =>
  new Promise(async (resolve, reject) => {
    try {
      const fileInfo = await bot.getFile(fileId);
      const url = `https://api.telegram.org/file/bot${TOKEN}/${fileInfo.file_path}`;
      const dest = path.join(tmpDir, `tg-${Date.now()}${ext}`);
      const out = fs.createWriteStream(dest);
      https.get(url, (res) => {
        res.pipe(out);
        out.on('finish', () => { out.close(); resolve(dest); });
      }).on('error', (e) => { fs.unlink(dest, () => {}); reject(e); });
    } catch (e) { reject(e); }
  });

/** Extract raw text from a file path */
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
  throw new Error('Unsupported file type. Please send a PDF or Word document.');
};




/** Format the analysis result into a neat Telegram message */
const formatReport = (r) => {
  const emoji = r.ats_score >= 75 ? '🟢' : r.ats_score >= 50 ? '🟡' : '🔴';
  const verdict = r.ats_score >= 75 ? 'STRONG MATCH' : r.ats_score >= 50 ? 'PARTIAL MATCH' : 'WEAK MATCH';

  let msg = `*📊 ATS ANALYSIS REPORT*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `${emoji} *Score:* \`${r.ats_score}/100\` — ${verdict}\n\n`;

  if (r.missing_keywords?.length) {
    msg += `*🔍 Missing Keywords*\n`;
    msg += r.missing_keywords.map(k => `• \`${k}\``).join('\n');
    msg += '\n\n';
  }

  if (r.optimization_suggestions?.length) {
    msg += `*💡 Optimization Suggestions*\n`;
    msg += r.optimization_suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
    msg += '\n\n';
  }

  msg += `*📥 Optimized CVs:* ${r.generated_variants?.length || 0} variant(s) — sending as files below...`;
  return msg;
};

// ── Bot conversation flow ──────────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  const id = msg.chat.id;
  sessions[id] = { step: 'idle' };

  bot.sendMessage(id,
    `👋 *Welcome to ResumeIQ Bot!*\n\n` +
    `I'll help you optimize your resume for ATS systems and get you more interviews.\n\n` +
    `*How it works:*\n` +
    `1️⃣ Send me the job description\n` +
    `2️⃣ Upload your resume (PDF or Word)\n` +
    `3️⃣ Get your ATS score + optimized CVs\n\n` +
    `Type /analyze to begin!`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/analyze/, (msg) => {
  const id = msg.chat.id;
  sessions[id] = { step: 'waiting_jd' };
  bot.sendMessage(id,
    `📋 *Step 1 of 2 — Job Description*\n\nPaste the full job description text below:`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `*ResumeIQ Bot — Commands*\n\n` +
    `/start — Welcome message\n` +
    `/analyze — Start a new ATS analysis\n` +
    `/help — Show this help message\n\n` +
    `*Supported file formats:* PDF, DOC, DOCX (max 20 MB)`,
    { parse_mode: 'Markdown' }
  );
});

// ── Handle all text messages (JD collection step) ─────────────────────────────
bot.on('message', async (msg) => {
  const id = msg.chat.id;
  const sess = getSession(id);

  // Skip command messages
  if (msg.text && msg.text.startsWith('/')) return;

  // ── Step: Collecting JD ──────────────────────────────────────────────────────
  if (sess.step === 'waiting_jd' && msg.text) {
    if (msg.text.trim().length < 50) {
      return bot.sendMessage(id, `⚠️ That looks too short for a job description. Please paste the full JD text.`);
    }
    sess.jd = msg.text.trim();
    sess.step = 'waiting_resume';
    return bot.sendMessage(id,
      `✅ Job description saved!\n\n📎 *Step 2 of 2 — Upload Resume*\n\nNow send your resume as a file (PDF, DOC, or DOCX):`,
      { parse_mode: 'Markdown' }
    );
  }

  // ── Step: Prompt user to start if they just text randomly ───────────────────
  if (sess.step === 'idle' && msg.text) {
    return bot.sendMessage(id, `Type /analyze to start a new resume analysis!`);
  }
});

// ── Handle document uploads (Resume collection step) ─────────────────────────
bot.on('document', async (msg) => {
  const id = msg.chat.id;
  const sess = getSession(id);

  if (sess.step !== 'waiting_resume') {
    return bot.sendMessage(id, `Please start an analysis first with /analyze`);
  }

  const doc = msg.document;
  const name = doc.file_name || '';
  const ext = path.extname(name).toLowerCase();

  if (!['.pdf', '.doc', '.docx'].includes(ext)) {
    return bot.sendMessage(id, `❌ Unsupported file type. Please send a PDF or Word document (.pdf, .doc, .docx)`);
  }

  sess.step = 'analyzing';
  let localPath = null;

  const loadingMsg = await bot.sendMessage(id,
    `⚙️ *Analyzing your resume...*\n\`\`\`\n$ resumeiq --analyze --mode=deep\n› extracting text... ⠋\n\`\`\``,
    { parse_mode: 'Markdown' }
  );

  try {
    // 1. Download file
    localPath = await downloadFile(doc.file_id, ext);

    // 2. Extract text
    const resumeText = await extractText(localPath);

    // 3. Run Groq AI analysis
    const result = await runGroqAnalysis(resumeText, sess.jd);

    // 4. Send report
    await bot.editMessageText(
      `⚙️ *Analyzing your resume...*\n\`\`\`\n$ resumeiq --analyze --mode=deep\n› extracting text...  ✓\n› running AI model...  ✓\n\`\`\``,
      { chat_id: id, message_id: loadingMsg.message_id, parse_mode: 'Markdown' }
    );

    await bot.sendMessage(id, formatReport(result), { parse_mode: 'Markdown' });

    // 5. Generate and send CV variants as formatted PDFs
    for (const variant of result.generated_variants || []) {
      const safeName = variant.style_name.replace(/\s+/g, '_');
      const pdfPath = path.join(tmpDir, `${safeName}_${Date.now()}.pdf`);
      await generateCVPdf(variant, pdfPath);
      await bot.sendDocument(id, pdfPath, {
        caption: `📄 *${variant.style_name}*\n_Formatted, ATS-optimised PDF — ready to send to employers._`,
        parse_mode: 'Markdown',
      });
      fs.unlink(pdfPath, () => {});
    }

    await bot.sendMessage(id,
      `✅ *Analysis complete!*\n\nType /analyze to scan another resume or /help for commands.`,
      { parse_mode: 'Markdown' }
    );

  } catch (err) {
    console.error('[TG BOT ERROR]', err);
    await bot.sendMessage(id, `❌ Something went wrong: ${err.message}\n\nPlease try again with /analyze`);
  } finally {
    // Cleanup
    if (localPath && fs.existsSync(localPath)) fs.unlink(localPath, () => {});
    sess.step = 'idle';
    sess.jd = null;
  }
});

console.log('🤖 ResumeIQ Telegram Bot is running...');
module.exports = bot;
