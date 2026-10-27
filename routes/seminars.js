const express = require('express');
const { get, all, run } = require('../db/database');
const router = express.Router();

// GET /api/seminars/:student_id
router.get('/seminars/:student_id', (req, res) => {
  try { res.json({ success: true, data: all('SELECT * FROM seminars WHERE student_id=? ORDER BY date DESC', [req.params.student_id]) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/seminars
router.post('/seminars', (req, res) => {
  try {
    const { student_id, date, title, organized_by, type, scope = 'Internal' } = req.body;
    if (!get('SELECT id FROM students WHERE id=?', [student_id]) || !String(title || '').trim()) return res.status(400).json({ success: false, error: 'Select a valid student and enter a title.' });
    if (!['Internal', 'External'].includes(scope) || (type && !['Technical', 'Non-Technical', 'Workshop', 'Webinar'].includes(type))) return res.status(400).json({ success: false, error: 'Choose a valid seminar scope and type.' });
    const r = run('INSERT INTO seminars (student_id,date,title,organized_by,type,scope) VALUES (?,?,?,?,?,?)',
      [student_id, date||null, title.trim(), organized_by||null, type||null, scope]);
    res.json({ success: true, data: get('SELECT * FROM seminars WHERE id=?', [r.lastID]) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// PUT /api/seminars/:id
router.put('/seminars/:id', (req, res) => {
  try {
    const { date, title, organized_by, type, scope = 'Internal' } = req.body;
    if (!String(title || '').trim() || !['Internal', 'External'].includes(scope) || (type && !['Technical', 'Non-Technical', 'Workshop', 'Webinar'].includes(type))) return res.status(400).json({ success: false, error: 'Enter a title and choose a valid seminar scope and type.' });
    run('UPDATE seminars SET date=?,title=?,organized_by=?,type=?,scope=? WHERE id=?',
      [date||null, title.trim(), organized_by||null, type||null, scope, req.params.id]);
    res.json({ success: true, data: get('SELECT * FROM seminars WHERE id=?', [req.params.id]) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// DELETE /api/seminars/:id
router.delete('/seminars/:id', (req, res) => {
  try { run('DELETE FROM seminars WHERE id=?', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/activities/:student_id
router.get('/activities/:student_id', (req, res) => {
  try { res.json({ success: true, data: all('SELECT * FROM activities WHERE student_id=? ORDER BY date DESC', [req.params.student_id]) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/activities
router.post('/activities', (req, res) => {
  try {
    const { student_id, date, activity_name, category, description, portfolio_group } = req.body;
    if (!get('SELECT id FROM students WHERE id=?', [student_id]) || !String(activity_name || '').trim()) return res.status(400).json({ success: false, error: 'Select a valid student and enter an activity name.' });
    if (!['Technical', 'Co-curricular', 'Extra-curricular'].includes(portfolio_group)) return res.status(400).json({ success: false, error: 'Select Technical, Co-curricular, or Extra-curricular.' });
    if (category && !['Cultural', 'Sports', 'Technical', 'Social', 'Other'].includes(category)) return res.status(400).json({ success: false, error: 'Choose a valid activity category.' });
    const r = run('INSERT INTO activities (student_id,date,activity_name,category,description,portfolio_group) VALUES (?,?,?,?,?,?)',
      [student_id, date||null, activity_name.trim(), category||null, description||null, portfolio_group]);
    res.json({ success: true, data: get('SELECT * FROM activities WHERE id=?', [r.lastID]) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// PUT /api/activities/:id
router.put('/activities/:id', (req, res) => {
  try {
    const { date, activity_name, category, description, portfolio_group } = req.body;
    if (!String(activity_name || '').trim() || !['Technical', 'Co-curricular', 'Extra-curricular'].includes(portfolio_group)) return res.status(400).json({ success: false, error: 'Enter an activity name and select a valid portfolio group.' });
    if (category && !['Cultural', 'Sports', 'Technical', 'Social', 'Other'].includes(category)) return res.status(400).json({ success: false, error: 'Choose a valid activity category.' });
    run('UPDATE activities SET date=?,activity_name=?,category=?,description=?,portfolio_group=? WHERE id=?',
      [date||null, activity_name.trim(), category||null, description||null, portfolio_group, req.params.id]);
    res.json({ success: true, data: get('SELECT * FROM activities WHERE id=?', [req.params.id]) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// DELETE /api/activities/:id
router.delete('/activities/:id', (req, res) => {
  try { run('DELETE FROM activities WHERE id=?', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
