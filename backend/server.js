require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const authRoutes      = require('./routes/auth');
const complaintRoutes = require('./routes/complaints');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: (_origin, cb) => cb(null, true), credentials: true }));
app.use(express.json({ limit: '10mb' }));

// ── Frontend Serve ──────────────────────────────────────
app.use(express.static(path.join(__dirname, '../')));

// ── API Routes ──────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/complaints', complaintRoutes);

// ── Health check ────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, msg: 'HostelCare API is running ✅' })
);

// ── Root → index.html ───────────────────────────────────
app.get('/', (_req, res) =>
  res.sendFile(path.join(__dirname, '../index.html'))
);

app.listen(PORT, () => {
  console.log(`🚀 HostelCare API running at http://localhost:${PORT}`);
});
