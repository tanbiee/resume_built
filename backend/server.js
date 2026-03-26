require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/', (req, res) => {
  res.json({ status: 'ResumeIQ API is running 🚀' });
});

// Routes
app.use('/api/resume', require('./routes/resumeRoutes'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🌐 Express API running on http://localhost:${PORT}`);

  // Launch Telegram bot (only if token is set)
  if (process.env.TELEGRAM_BOT_TOKEN) {
    require('./bot/telegramBot');
    console.log('🤖 Telegram bot started');
  } else {
    console.log('⚠️  TELEGRAM_BOT_TOKEN not set — Telegram bot skipped');
  }
});

