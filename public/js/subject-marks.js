// subject-marks.js - Subject Marks page logic

let currentStudentId = null;
let currentSemester = null;

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadStudentsDropdown();

  document.getElementById('view-btn').addEventListener('click', async () => {
    currentStudentId = document.getElementById('student-select').value;
    currentSemester = document.getElementById('semester-select').value;
    if (!currentStudentId || !currentSemester) {
      showToast('Please select both student and semester', 'error'); return;
    }
    document.getElementById('marks-section').style.display = 'block';
    document.getElementById('no-selection-msg').style.display = 'none';
    await loadMarks();
  });
});

async function loadStudentsDropdown() {
  try {
    const res = await fetch('/api/students');
    const json = await res.json();
    if (!json.success) return;
    const sel = document.getElementById('student-select');
    json.data.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.roll_no} - ${s.full_name} (${s.department})`;
      sel.appendChild(opt);
    });
  } catch { showToast('Failed to load students', 'error'); }
}

async function loadMarks() {
  try {
    const res = await fetch(`/api/subject-marks/${currentStudentId}/${currentSemester}`);
    const json = await res.json();
    const tbody = document.getElementById('marks-tbody');

    document.getElementById('marks-title').textContent =
      `Semester ${currentSemester} Subject Marks`;

    if (!json.success || json.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">No marks found for this semester.</td></tr>';
      document.getElementById('sgpa-display').textContent = '-';
      return;
    }

    const marks = json.data;
    // Compute SGPA
    const avg = marks.reduce((s, m) => s + m.marks, 0) / marks.length;
    const sgpa = (avg / 10).toFixed(2);
    document.getElementById('sgpa-display').textContent = sgpa;

    tbody.innerHTML = marks.map(m => `
      <tr>
        <td>${m.component_type}</td>
        <td>${m.subject_code}</td>
        <td>${m.subject_name}</td>
        <td>${m.marks}</td>
        <td><span class="grade-badge">${m.grade}</span></td>
        <td class="action-btns">
          <button class="btn-icon btn-icon-danger" title="Delete" onclick="deleteMark(${m.id})">🗑</button>
        </td>
      </tr>
    `).join('');
  } catch { showToast('Error loading marks', 'error'); }
}

async function deleteMark(id) {
  if (!confirm('Delete this mark entry?')) return;
  try {
    const res = await fetch(`/api/semester-results/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) { showToast('Entry deleted.'); await loadMarks(); }
    else showToast(json.error || 'Failed to delete', 'error');
  } catch { showToast('Error deleting', 'error'); }
}
