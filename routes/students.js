const express = require('express');
const { get, all, run, tableExists } = require('../db/database');
const router = express.Router();

function computeSGPA(student_id, semester) {
  const results = all(`SELECT r.marks FROM student_subject_results r JOIN subjects sub ON sub.id=r.subject_id
    WHERE r.student_id=? AND sub.semester=?`, [student_id, semester]);
  if (!results.length) return 0;
  const avg = results.reduce((s, r) => s + r.marks, 0) / results.length;
  return Math.round((avg / 10) * 100) / 100;
}

function computeCGPA(student_id) {
  const marks = all('SELECT marks FROM student_subject_results WHERE student_id=?', [student_id]);
  if (!marks.length) return null;
  const average = marks.reduce((sum, row) => sum + row.marks, 0) / marks.length;
  return Math.round((average / 10) * 100) / 100;
}

function validateStudent(body = {}) {
  const { roll_no, full_name, department } = body;
  if (!String(roll_no || '').trim() || !String(full_name || '').trim() || !String(department || '').trim()) {
    return { error: 'Roll No, Full Name, and Department are required.' };
  }
  if (body.status && !['Active', 'Inactive'].includes(body.status)) return { error: 'Status must be Active or Inactive.' };
  const percentages = {};
  for (const field of ['ssc_percent', 'hsc_percent', 'diploma_percent']) {
    const value = body[field];
    if (value === '' || value === null || value === undefined) percentages[field] = null;
    else if (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100) return { error: `${field} must be between 0 and 100.` };
    else percentages[field] = Number(value);
  }
  return {
    data: {
      roll_no: String(roll_no).trim(), full_name: String(full_name).trim(), department: String(department).trim(),
      dob: body.dob || null, gender: body.gender || null, email: body.email || null, phone: body.phone || null,
      address: body.address || null, ...percentages, status: body.status || 'Active'
    }
  };
}

// GET /api/students
router.get('/students', (req, res) => {
  try {
    const students = all('SELECT * FROM students ORDER BY CAST(roll_no AS INTEGER)');
    const result = students.map(s => {
      const semRow = get(`SELECT MAX(sub.semester) as ms FROM student_subject_results r JOIN subjects sub ON sub.id=r.subject_id WHERE r.student_id=?`, [s.id]);
      const current_semester = semRow ? semRow.ms : null;
      const last_sgpa = current_semester ? computeSGPA(s.id, current_semester) : null;
      return { ...s, current_semester, last_sgpa };
    });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/students/search
router.get('/students/search', (req, res) => {
  try {
    const q = `%${req.query.q || ''}%`;
    const students = all('SELECT * FROM students WHERE full_name LIKE ? OR roll_no LIKE ? ORDER BY CAST(roll_no AS INTEGER)', [q, q]);
    const result = students.map(s => {
      const semRow = get(`SELECT MAX(sub.semester) as ms FROM student_subject_results r JOIN subjects sub ON sub.id=r.subject_id WHERE r.student_id=?`, [s.id]);
      const current_semester = semRow ? semRow.ms : null;
      const last_sgpa = current_semester ? computeSGPA(s.id, current_semester) : null;
      return { ...s, current_semester, last_sgpa };
    });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/students/:id
router.get('/students/:id', (req, res) => {
  try {
    const s = get('SELECT * FROM students WHERE id=?', [req.params.id]);
    if (!s) return res.json({ success: false, error: 'Student not found' });
    const semRow = get(`SELECT MAX(sub.semester) as ms FROM student_subject_results r JOIN subjects sub ON sub.id=r.subject_id WHERE r.student_id=?`, [s.id]);
    const current_semester = semRow ? semRow.ms : null;
    const last_sgpa = current_semester ? computeSGPA(s.id, current_semester) : null;
    const cgpa = computeCGPA(s.id);
    res.json({ success: true, data: { ...s, current_semester, last_sgpa, cgpa } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/students
router.post('/students', (req, res) => {
  try {
    const validation = validateStudent(req.body);
    if (validation.error) return res.status(400).json({ success: false, error: validation.error });
    const { roll_no, full_name, department, dob, gender, email, phone, address, ssc_percent, hsc_percent, diploma_percent, status } = validation.data;

    const r = run(
      `INSERT INTO students (roll_no,full_name,dob,gender,department,email,phone,address,ssc_percent,hsc_percent,diploma_percent,status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [roll_no, full_name, dob, gender, department, email, phone, address, ssc_percent, hsc_percent, diploma_percent, status]
    );
    const newStudent = get('SELECT * FROM students WHERE id=?', [r.lastID]);
    res.json({ success: true, data: newStudent });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ success: false, error: 'Roll No already exists.' });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/students/:id
router.put('/students/:id', (req, res) => {
  try {
    const validation = validateStudent(req.body);
    if (validation.error) return res.status(400).json({ success: false, error: validation.error });
    const { roll_no, full_name, department, dob, gender, email, phone, address, ssc_percent, hsc_percent, diploma_percent, status } = validation.data;
    const existing = get('SELECT department FROM students WHERE id=?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Student not found.' });
    if (existing.department !== department && get('SELECT id FROM student_subject_results WHERE student_id=? LIMIT 1', [req.params.id])) {
      return res.status(409).json({ success: false, error: 'A student with semester results cannot change department. Move or remove the result records first.' });
    }

    run(
      `UPDATE students SET roll_no=?,full_name=?,dob=?,gender=?,department=?,email=?,phone=?,address=?,ssc_percent=?,hsc_percent=?,diploma_percent=?,status=? WHERE id=?`,
      [roll_no, full_name, dob, gender, department, email, phone, address, ssc_percent, hsc_percent, diploma_percent, status, req.params.id]
    );
    const updated = get('SELECT * FROM students WHERE id=?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ success: false, error: 'Roll No already exists.' });
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/students/:id
router.delete('/students/:id', (req, res) => {
  try {
    // The explicit deletes also clean legacy rows preserved by the additive migration.
    run('DELETE FROM student_subject_results WHERE student_id=?', [req.params.id]);
    if (tableExists('semester_results')) run('DELETE FROM semester_results WHERE student_id=?', [req.params.id]);
    run('DELETE FROM academic_gaps WHERE student_id=?', [req.params.id]);
    run('DELETE FROM seminars WHERE student_id=?', [req.params.id]);
    run('DELETE FROM activities WHERE student_id=?', [req.params.id]);
    run('DELETE FROM students WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
