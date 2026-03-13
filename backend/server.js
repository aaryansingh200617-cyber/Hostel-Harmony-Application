require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes      = require('./routes/auth');
const complaintRoutes = require('./routes/complaints');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: (_origin, cb) => cb(null, true),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/complaints', complaintRoutes);

// ── Health check ────────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, msg: 'HostelCare API is running ✅' })
);

// ── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 HostelCare API running at http://localhost:${PORT}`);
});
