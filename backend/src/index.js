const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security middleware ──────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:5173', // React frontend (Vite)
  credentials: true
}));
app.use(express.json({ limit: '10kb' })); // limit body size

// ── Rate limiter — protects AI endpoint costs ────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // max 100 requests per window
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ── Health check route ───────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Smart Summarizer API is running',
    timestamp: new Date().toISOString()
  });
});

// ── 404 handler ──────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start server ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
});