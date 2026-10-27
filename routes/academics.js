const express = require('express');
const { get, all, run } = require('../db/database');
const router = express.Router();

function resultById(id) {
  return get(`SELECT r.id, r.student_id, s.semester, s.subject_code, s.subject_name,
      s.component_type, r.marks, r.grade
    FROM student_subject_results r JOIN subjects s ON s.id = r.subject_id WHERE r.id=?`, [id]);
}

function gradeForMarks(marks) {
  if (marks >= 90) return 'O';
  if (marks >= 80) return 'A';
  if (marks >= 70) return 'B+';
  if (marks >= 60) return 'B';
  return 'C';
}

function validateResultInput(body = {}, studentId) {
  const semester = Number(body.semester);
  const marks = Number(body.marks);
  const subjectCode = String(body.subject_code || '').trim();
  const subjectName = String(body.subject_name || '').trim();
  const componentType = body.component_type || 'Theory';
  if (!studentId || !Number.isInteger(semester) || semester < 1 || semester > 8 ||
      !subjectCode || !subjectName || !Number.isInteger(marks) || marks < 0 || marks > 100 ||
      !['Theory', 'Lab'].includes(componentType)) {
    return { error: 'Provide a valid student, semester (1-8), subject, component type, and integer marks (0-100).' };
  }
  const student = get('SELECT id, department FROM students WHERE id=?', [studentId]);
  if (!student) return { error: 'Student not found.' };
  let subject = get('SELECT * FROM subjects WHERE department=? AND semester=? AND subject_code=? AND component_type=?',
    [student.department, semester, subjectCode, componentType]);
  if (subject && subject.subject_name !== subjectName) {
    return { error: 'That subject code is already assigned to a different subject name in this department and semester.' };
  }
  if (!subject) {
    run('INSERT INTO subjects (department,semester,subject_code,subject_name,component_type) VALUES (?,?,?,?,?)',
      [student.department, semester, subjectCode, subjectName, componentType]);
    subject = get('SELECT * FROM subjects WHERE department=? AND semester=? AND subject_code=? AND component_type=?',
      [student.department, semester, subjectCode, componentType]);
  }
  return { student, subject, marks, grade: gradeForMarks(marks) };
}

// GET /api/semester-results/:student_id
router.get('/semester-results/:student_id', (req, res) => {
  try {
    const rows = all(`SELECT r.id, r.student_id, sub.semester, sub.subject_code, sub.subject_name,
        sub.component_type, r.marks, r.grade
      FROM student_subject_results r JOIN subjects sub ON sub.id=r.subject_id
      WHERE r.student_id=? ORDER BY sub.semester, sub.component_type, sub.subject_code`, [req.params.student_id]);
    const grouped = {};
    rows.forEach(r => {
      if (!grouped[r.semester]) grouped[r.semester] = [];
      grouped[r.semester].push(r);
    });
    const result = Object.keys(grouped).sort((a, b) => +a - +b).map(sem => {
      const subjects = grouped[sem];
      const avg = subjects.reduce((s, r) => s + r.marks, 0) / subjects.length;
      const sgpa = Math.round((avg / 10) * 100) / 100;
      const prior = Object.keys(grouped).filter(key => Number(key) <= Number(sem)).sort((a,b) => Number(a)-Number(b));
      const cumulativeMarks = prior.flatMap(key => grouped[key]).reduce((sum, row) => sum + row.marks, 0);
      const cumulativeCount = prior.reduce((sum, key) => sum + grouped[key].length, 0);
      const cgpa = Math.round((cumulativeMarks / cumulativeCount / 10) * 100) / 100;
      return { semester: parseInt(sem), sgpa, cgpa, subjects };
    });
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ success: false, error: 'This subject already has a result for the student.' });
    if (err.message.includes('CHECK') || err.message.includes('FOREIGN KEY')) return res.status(400).json({ success: false, error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/semester-results
router.post('/semester-results', (req, res) => {
  try {
    const input = validateResultInput(req.body, req.body.student_id);
    if (input.error) return res.status(400).json({ success: false, error: input.error });
    const r = run('INSERT INTO student_subject_results (student_id,subject_id,marks,grade) VALUES (?,?,?,?)',
      [input.student.id, input.subject.id, input.marks, input.grade]);
    const newRow = resultById(r.lastID);
    res.json({ success: true, data: newRow });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ success: false, error: 'This subject already has a result for the student.' });
    if (err.message.includes('CHECK') || err.message.includes('FOREIGN KEY')) return res.status(400).json({ success: false, error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/semester-results/:id
router.put('/semester-results/:id', (req, res) => {
  try {
    const existing = resultById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Result not found.' });
    const input = validateResultInput(req.body, existing.student_id);
    if (input.error) return res.status(400).json({ success: false, error: input.error });
    run('UPDATE student_subject_results SET subject_id=?,marks=?,grade=? WHERE id=?',
      [input.subject.id, input.marks, input.grade, req.params.id]);
    res.json({ success: true, data: resultById(req.params.id) });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ success: false, error: 'This subject already has a result for the student.' });
    if (err.message.includes('CHECK') || err.message.includes('FOREIGN KEY')) return res.status(400).json({ success: false, error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/semester-results/:id
router.delete('/semester-results/:id', (req, res) => {
  try {
    run('DELETE FROM student_subject_results WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/subject-marks/:student_id/:semester
router.get('/subject-marks/:student_id/:semester', (req, res) => {
  try {
    const rows = all(`SELECT r.id, r.student_id, sub.semester, sub.subject_code, sub.subject_name,
        sub.component_type, r.marks, r.grade
      FROM student_subject_results r JOIN subjects sub ON sub.id=r.subject_id
      WHERE r.student_id=? AND sub.semester=? ORDER BY sub.component_type, sub.subject_code`, [req.params.student_id, req.params.semester]);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/academic-gaps/:student_id
router.get('/academic-gaps/:student_id', (req, res) => {
  try {
    res.json({ success: true, data: all('SELECT * FROM academic_gaps WHERE student_id=? ORDER BY id', [req.params.student_id]) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/academic-gaps
router.post('/academic-gaps', (req, res) => {
  try {
    const { student_id, semester, description, identified_date, gap_type = 'Academic Gap', start_date, end_date } = req.body;
    const sem = semester ? Number(semester) : null;
    if (!get('SELECT id FROM students WHERE id=?', [student_id])) return res.status(400).json({ success: false, error: 'Student not found.' });
    if (!String(description || '').trim() || !['Academic Gap', 'Drop Year'].includes(gap_type) ||
        (sem !== null && (!Number.isInteger(sem) || sem < 1 || sem > 8)) ||
        (start_date && end_date && end_date < start_date) ||
        (gap_type === 'Drop Year' && (!start_date || !end_date))) {
      return res.status(400).json({ success: false, error: 'Provide a description, valid gap type, and a valid semester or date range.' });
    }
    const r = run(`INSERT INTO academic_gaps (student_id,semester,description,identified_date,gap_type,start_date,end_date)
      VALUES (?,?,?,?,?,?,?)`,
      [student_id, sem, description.trim(), identified_date||null, gap_type, start_date||null, end_date||null]);
    res.json({ success: true, data: get('SELECT * FROM academic_gaps WHERE id=?', [r.lastID]) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// PUT /api/academic-gaps/:id
router.put('/academic-gaps/:id', (req, res) => {
  try {
    const { semester, description, identified_date, gap_type = 'Academic Gap', start_date, end_date } = req.body;
    const sem = semester ? Number(semester) : null;
    if (!String(description || '').trim() || !['Academic Gap', 'Drop Year'].includes(gap_type) ||
        (sem !== null && (!Number.isInteger(sem) || sem < 1 || sem > 8)) ||
        (start_date && end_date && end_date < start_date) ||
        (gap_type === 'Drop Year' && (!start_date || !end_date))) {
      return res.status(400).json({ success: false, error: 'Provide a description, valid gap type, and a valid semester or date range.' });
    }
    run(`UPDATE academic_gaps SET semester=?,description=?,identified_date=?,gap_type=?,start_date=?,end_date=? WHERE id=?`,
      [sem, description.trim(), identified_date||null, gap_type, start_date||null, end_date||null, req.params.id]);
    res.json({ success: true, data: get('SELECT * FROM academic_gaps WHERE id=?', [req.params.id]) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// DELETE /api/academic-gaps/:id
router.delete('/academic-gaps/:id', (req, res) => {
  try {
    run('DELETE FROM academic_gaps WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
