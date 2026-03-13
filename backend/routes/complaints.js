const express    = require('express');
const supabase   = require('../supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── Helper: map DB row to frontend shape ───────────────────
function toFrontend(c) {
  return {
    id:                    c.id,
    userId:                c.user_id,
    userName:              c.user_name,
    description:           c.description,
    category:              c.category,
    priority:              c.priority,
    status:                c.status,
    block:                 c.block,
    room:                  c.room,
    image:                 c.image,
    assignedTechName:      c.assigned_tech_name,
    assignedTechPhone:     c.assigned_tech_phone,
    assignedTechSpecialty: c.assigned_tech_specialty,
    resolvedAt:            c.resolved_at,
    rating:                c.rating,
    feedback:              c.feedback,
    statusHistory:         c.status_history || [],
    createdAt:             c.created_at,
    updatedAt:             c.updated_at,
  };
}

// ── GET ALL ────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    let query = supabase.from('complaints').select('*').order('created_at', { ascending: false });

    if (req.user.role === 'student') {
      query = query.eq('user_id', req.user.id);
    }

    const { data: complaints, error } = await query;
    if (error) throw error;

    return res.json({ ok: true, complaints: complaints.map(toFrontend) });
  } catch (err) {
    console.error('Get complaints error:', err);
    return res.status(500).json({ ok: false, msg: 'Failed to fetch complaints.' });
  }
});

// ── CREATE ─────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { description, category, priority, room, block, image } = req.body;

    if (!description || !category)
      return res.status(400).json({ ok: false, msg: 'Description and category are required.' });

    const now           = new Date().toISOString();
    const statusHistory = [{ status: 'Submitted', time: now }];

    const { data: [complaint], error } = await supabase
      .from('complaints')
      .insert({
        user_id:        req.user.id,
        user_name:      req.user.name,
        description,
        category,
        priority:       priority || 'Low',
        status:         'Submitted',
        block:          block || req.user.block,
        room:           room  || req.user.room,
        image:          image || null,
        status_history: statusHistory,
      })
      .select();

    if (error) throw error;

    return res.status(201).json({ ok: true, complaint: toFrontend(complaint) });
  } catch (err) {
    console.error('Create complaint error:', err);
    return res.status(500).json({ ok: false, msg: 'Failed to create complaint.' });
  }
});

// ── UPDATE (warden only) ───────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'warden')
      return res.status(403).json({ ok: false, msg: 'Only wardens can update complaint status.' });

    const { data: complaint, error: fetchErr } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !complaint)
      return res.status(404).json({ ok: false, msg: 'Complaint not found.' });

    const { status, assignedTechName, assignedTechPhone, assignedTechSpecialty } = req.body;
    const updates = {};

    if (status && status !== complaint.status) {
      const history = [...(complaint.status_history || []), { status, time: new Date().toISOString() }];
      updates.status         = status;
      updates.status_history = history;
      if (status === 'Resolved') updates.resolved_at = new Date().toISOString();
    }
    if (assignedTechName      !== undefined) updates.assigned_tech_name      = assignedTechName;
    if (assignedTechPhone     !== undefined) updates.assigned_tech_phone     = assignedTechPhone;
    if (assignedTechSpecialty !== undefined) updates.assigned_tech_specialty = assignedTechSpecialty;

    updates.updated_at = new Date().toISOString();

    const { data: [updated], error: updateErr } = await supabase
      .from('complaints')
      .update(updates)
      .eq('id', req.params.id)
      .select();

    if (updateErr) throw updateErr;

    return res.json({ ok: true, complaint: toFrontend(updated) });
  } catch (err) {
    console.error('Update complaint error:', err);
    return res.status(500).json({ ok: false, msg: 'Failed to update complaint.' });
  }
});

// ── RATE (student only, must own) ──────────────────────────
router.put('/:id/rate', async (req, res) => {
  try {
    const { data: complaint, error: fetchErr } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !complaint)
      return res.status(404).json({ ok: false, msg: 'Complaint not found.' });

    if (complaint.user_id !== req.user.id)
      return res.status(403).json({ ok: false, msg: 'You can only rate your own complaints.' });

    const { rating, feedback } = req.body;
    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ ok: false, msg: 'Rating must be between 1 and 5.' });

    const { data: [updated], error: updateErr } = await supabase
      .from('complaints')
      .update({ rating, feedback: feedback || null, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select();

    if (updateErr) throw updateErr;

    return res.json({ ok: true, complaint: toFrontend(updated) });
  } catch (err) {
    console.error('Rate complaint error:', err);
    return res.status(500).json({ ok: false, msg: 'Failed to submit rating.' });
  }
});

module.exports = router;
