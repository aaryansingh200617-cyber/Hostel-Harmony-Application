const express    = require('express');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const supabase   = require('../supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ── Helper: safe user object (no password) ─────────────────
function safeUser(u) {
  return {
    id:          u.id,
    name:        u.name,
    email:       u.email,
    role:        u.role,
    hostelType:  u.hostel_type,
    block:       u.block,
    room:        u.room,
    designation: u.designation,
    createdAt:   u.created_at,
  };
}

// ── Helper: email transporter ──────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// ── REGISTER ───────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, hostelType, block, room, designation } = req.body;

    if (!name || !email || !password || !role)
      return res.status(400).json({ ok: false, msg: 'Name, email, password, and role are required.' });
    if (password.length < 6)
      return res.status(400).json({ ok: false, msg: 'Password must be at least 6 characters.' });

    const normalEmail = email.toLowerCase().trim();

    // Check existing user
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalEmail)
      .maybeSingle();

    if (existing)
      return res.status(409).json({ ok: false, msg: 'This email is already registered. Please log in.' });

    const hashed = await bcrypt.hash(password, 10);

    const userData = {
      name:        name.trim(),
      email:       normalEmail,
      password:    hashed,
      role,
      hostel_type: role === 'student' ? hostelType : 'All',
      block:       role === 'student' ? block : 'All',
      room:        role === 'student' ? room  : 'Warden Office',
      designation: role === 'warden' ? (designation || 'Warden') : null,
    };

    if (role === 'student' && (!hostelType || !block || !room))
      return res.status(400).json({ ok: false, msg: 'Hostel type, block, and room are required for students.' });

    const { error } = await supabase.from('users').insert(userData);
    if (error) throw error;

    return res.status(201).json({ ok: true, msg: 'Account created successfully!' });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ ok: false, msg: 'Server error. Please try again.' });
  }
});

// ── LOGIN ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ ok: false, msg: 'Email and password are required.' });

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error || !user)
      return res.status(401).json({ ok: false, msg: 'Invalid email or password.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ ok: false, msg: 'Invalid email or password.' });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ ok: true, token, user: safeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ ok: false, msg: 'Server error. Please try again.' });
  }
});

// ── GET CURRENT USER ───────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  res.json({ ok: true, user: safeUser(req.user) });
});

// ── FORGOT PASSWORD ────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ ok: false, msg: 'Email is required.' });

    const normalEmail = email.toLowerCase().trim();

    const { data: user } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('email', normalEmail)
      .maybeSingle();

    // Always return success to prevent email enumeration
    if (!user)
      return res.json({ ok: true, msg: 'If that email is registered, a reset link has been sent.' });

    // Generate a secure token
    const resetToken  = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt   = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Store token in DB
    await supabase.from('password_reset_tokens').upsert({
      user_id:     user.id,
      token:       hashedToken,
      expires_at:  expiresAt,
      used:        false,
    }, { onConflict: 'user_id' });

    // Build reset link
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5500';
    const resetLink    = `${frontendBase}/reset-password.html?token=${resetToken}&email=${encodeURIComponent(normalEmail)}`;

    // Send email
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    `"HostelCare" <${process.env.EMAIL_USER}>`,
      to:      normalEmail,
      subject: 'HostelCare — Password Reset Request',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;border:1px solid #e2e8f0;border-radius:8px;">
          <h2 style="color:#4f46e5;margin-top:0;">HostelCare Password Reset</h2>
          <p>Hi <strong>${user.name}</strong>,</p>
          <p>We received a request to reset your password. Click the button below to continue. This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetLink}"
             style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">
            Reset My Password
          </a>
          <p style="color:#64748b;font-size:13px;">Or copy this link into your browser:<br/>${resetLink}</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
          <p style="color:#94a3b8;font-size:12px;">If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
        </div>
      `,
    });

    return res.json({ ok: true, msg: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ ok: false, msg: 'Failed to send reset email. Please try again.' });
  }
});

// ── RESET PASSWORD ─────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, email, password } = req.body;

    if (!token || !email || !password)
      return res.status(400).json({ ok: false, msg: 'Token, email, and new password are required.' });
    if (password.length < 6)
      return res.status(400).json({ ok: false, msg: 'Password must be at least 6 characters.' });

    const hashedToken  = crypto.createHash('sha256').update(token).digest('hex');
    const normalEmail  = email.toLowerCase().trim();

    // Find user
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalEmail)
      .maybeSingle();

    if (!user)
      return res.status(400).json({ ok: false, msg: 'Invalid or expired reset link.' });

    // Find valid token
    const { data: resetRecord } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('token', hashedToken)
      .eq('used', false)
      .maybeSingle();

    if (!resetRecord)
      return res.status(400).json({ ok: false, msg: 'Invalid or expired reset link.' });

    if (new Date(resetRecord.expires_at) < new Date())
      return res.status(400).json({ ok: false, msg: 'This reset link has expired. Please request a new one.' });

    // Update password
    const hashed = await bcrypt.hash(password, 10);
    await supabase.from('users').update({ password: hashed }).eq('id', user.id);

    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('user_id', user.id);

    return res.json({ ok: true, msg: 'Password reset successfully! You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ ok: false, msg: 'Server error. Please try again.' });
  }
});

module.exports = router;
