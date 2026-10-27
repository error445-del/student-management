const express = require('express');
const { all } = require('../db/database');
const router = express.Router();

// GET /api/reports/progress
router.get('/reports/progress', (req, res) => {
  try {
    const departments = all('SELECT DISTINCT department FROM students ORDER BY department');
    const result = departments.map(({ department }) => {
      const students = all('SELECT id FROM students WHERE department=?', [department]);
      let totalCGPA = 0, validCount = 0;
      for (const s of students) {
        const semRows = all(`SELECT sub.semester, AVG(r.marks) as avg_marks FROM student_subject_results r
          JOIN subjects sub ON sub.id=r.subject_id WHERE r.student_id=? GROUP BY sub.semester`, [s.id]);
        if (semRows.length > 0) {
          totalCGPA += semRows.reduce((sum, r) => sum + (r.avg_marks / 10), 0) / semRows.length;
          validCount++;
        }
      }
      return {
        department,
        student_count: students.length,
        average_latest_cgpa: validCount > 0 ? Math.round((totalCGPA / validCount) * 100) / 100 : 0
      };
    });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/reports/export-csv
router.get('/reports/export-csv', (req, res) => {
  try {
    const departments = all('SELECT DISTINCT department FROM students ORDER BY department');
    const rows = departments.map(({ department }) => {
      const students = all('SELECT id FROM students WHERE department=?', [department]);
      let totalCGPA = 0, validCount = 0;
      for (const s of students) {
        const semRows = all(`SELECT AVG(r.marks) as avg_marks FROM student_subject_results r JOIN subjects sub ON sub.id=r.subject_id
          WHERE r.student_id=? GROUP BY sub.semester`, [s.id]);
        if (semRows.length > 0) {
          totalCGPA += semRows.reduce((sum, r) => sum + (r.avg_marks / 10), 0) / semRows.length;
          validCount++;
        }
      }
      const avg = validCount > 0 ? (totalCGPA / validCount).toFixed(2) : '0.00';
      return `${department},${students.length},${avg}`;
    });
    const csv = 'department,student_count,average_latest_cgpa\n' + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="student_progress_report.csv"');
    res.send(csv);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
