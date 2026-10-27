const express = require('express');
const { get, all } = require('../db/database');
const router = express.Router();

// GET /api/dashboard/stats
router.get('/dashboard/stats', (req, res) => {
  try {
    const total_students = get('SELECT COUNT(*) as cnt FROM students').cnt;
    const total_semesters_recorded = get(`SELECT COUNT(DISTINCT (r.student_id || '-' || sub.semester)) as cnt
      FROM student_subject_results r JOIN subjects sub ON sub.id=r.subject_id`).cnt;
    const total_seminars = get('SELECT COUNT(*) as cnt FROM seminars').cnt;
    const total_activities = get('SELECT COUNT(*) as cnt FROM activities').cnt;

    const students_per_dept = all('SELECT department as dept, COUNT(*) as count FROM students GROUP BY department ORDER BY count DESC');

    const semData = all(`SELECT sub.semester, AVG(r.marks) as avg_marks FROM student_subject_results r
      JOIN subjects sub ON sub.id=r.subject_id GROUP BY sub.semester ORDER BY sub.semester`);
    const avg_sgpa_trend = semData.map(s => ({
      semester: s.semester,
      avg_sgpa: Math.round((s.avg_marks / 10) * 100) / 100
    }));

    const recents = all(`
      SELECT s.*, (SELECT MAX(sub.semester) FROM student_subject_results r JOIN subjects sub ON sub.id=r.subject_id WHERE r.student_id = s.id) as current_semester
      FROM students s ORDER BY s.id DESC LIMIT 5
    `);

    const recent_students = recents.map(s => {
      let last_sgpa = null;
      if (s.current_semester) {
        const semMarks = all(`SELECT r.marks FROM student_subject_results r JOIN subjects sub ON sub.id=r.subject_id
          WHERE r.student_id = ? AND sub.semester = ?`, [s.id, s.current_semester]);
        if (semMarks.length > 0) {
          const avg = semMarks.reduce((sum, r) => sum + r.marks, 0) / semMarks.length;
          last_sgpa = Math.round((avg / 10) * 100) / 100;
        }
      }
      return { ...s, last_sgpa };
    });

    res.json({ success: true, data: { total_students, total_semesters_recorded, total_seminars, total_activities, students_per_dept, avg_sgpa_trend, recent_students } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
