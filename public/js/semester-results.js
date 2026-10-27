// semester-results.js - Semester Results page logic

let semesterChart = null;
let currentStudentId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadStudentsDropdown();

  document.getElementById('student-select').addEventListener('change', async (e) => {
    currentStudentId = e.target.value;
    if (currentStudentId) {
      document.getElementById('add-result-btn').style.display = 'inline-flex';
      document.getElementById('results-section').style.display = 'block';
      document.getElementById('no-student-msg').style.display = 'none';
      await loadResults(currentStudentId);
    } else {
      document.getElementById('add-result-btn').style.display = 'none';
      document.getElementById('results-section').style.display = 'none';
      document.getElementById('no-student-msg').style.display = 'flex';
    }
  });

  document.getElementById('add-result-btn').addEventListener('click', () => {
    document.getElementById('r-semester').value = '';
    document.getElementById('r-subject-code').value = '';
    document.getElementById('r-subject-name').value = '';
    document.getElementById('r-component-type').value = 'Theory';
    document.getElementById('r-marks').value = '';
    document.getElementById('r-grade').value = '';
    openModal('result-modal');
  });

  document.getElementById('save-result-btn').addEventListener('click', saveResult);

  document.getElementById('result-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('result-modal')) closeModal('result-modal');
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

async function loadResults(studentId) {
  try {
    const res = await fetch(`/api/semester-results/${studentId}`);
    const json = await res.json();
    if (!json.success) { showToast('Failed to load results', 'error'); return; }

    const grouped = json.data;
    const container = document.getElementById('results-by-semester');

    if (!grouped || grouped.length === 0) {
      container.innerHTML = '<p class="loading-cell">No results recorded for this student.</p>';
      if (semesterChart) { semesterChart.destroy(); semesterChart = null; }
      return;
    }

    // SGPA Chart
    const ctx = document.getElementById('sem-sgpa-chart').getContext('2d');
    if (semesterChart) semesterChart.destroy();
    semesterChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: grouped.map(g => 'Sem ' + g.semester),
        datasets: [{
          label: 'SGPA',
          data: grouped.map(g => g.sgpa),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          fill: true, tension: 0.3,
          pointBackgroundColor: '#2563eb', pointRadius: 5
        }, {
          label: 'CGPA', data: grouped.map(g => g.cgpa), borderColor: '#f97316',
          backgroundColor: 'transparent', fill: false, tension: 0.3, pointRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        scales: { y: { min: 0, max: 10 } }
      }
    });

    // Results Table
    container.innerHTML = grouped.map(g => `
      <div class="sem-block">
        <div class="sem-header">
          <span>Semester ${g.semester}</span>
          <span class="sgpa-pill">SGPA: ${g.sgpa}</span>
        </div>
        <table class="data-table">
          <thead><tr><th>Type</th><th>Code</th><th>Subject Name</th><th>Marks</th><th>Grade</th><th>Action</th></tr></thead>
          <tbody>
            ${g.subjects.map(sub => `
              <tr>
                <td>${sub.component_type}</td>
                <td>${sub.subject_code}</td>
                <td>${sub.subject_name}</td>
                <td>${sub.marks}</td>
                <td><span class="grade-badge">${sub.grade}</span></td>
                <td><button class="btn-icon btn-icon-danger" title="Delete" onclick="deleteResult(${sub.id})">🗑</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
    showToast('Error loading results', 'error');
  }
}

function updateGradePreview() {
  const marks = parseInt(document.getElementById('r-marks').value);
  if (!isNaN(marks)) {
    document.getElementById('r-grade').value = computeGrade(marks);
  }
}

async function saveResult() {
  const semester = document.getElementById('r-semester').value;
  const subjectCode = document.getElementById('r-subject-code').value.trim();
  const subjectName = document.getElementById('r-subject-name').value.trim();
  const marks = parseInt(document.getElementById('r-marks').value);

  if (!semester || !subjectCode || !subjectName || isNaN(marks)) {
    showToast('All fields are required', 'error'); return;
  }
  if (marks < 0 || marks > 100) { showToast('Marks must be 0-100', 'error'); return; }

  const btn = document.getElementById('save-result-btn');
  btn.disabled = true;
  try {
    const res = await fetch('/api/semester-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: currentStudentId,
        semester: parseInt(semester),
        subject_code: subjectCode,
        subject_name: subjectName,
        component_type: document.getElementById('r-component-type').value,
        marks,
        grade: computeGrade(marks)
      })
    });
    const json = await res.json();
    if (json.success) {
      showToast('Result added!');
      closeModal('result-modal');
      await loadResults(currentStudentId);
    } else {
      showToast(json.error || 'Failed to add result', 'error');
    }
  } catch { showToast('Error saving result', 'error'); }
  finally { btn.disabled = false; }
}

async function deleteResult(id) {
  if (!confirm('Delete this result entry?')) return;
  try {
    const res = await fetch(`/api/semester-results/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) { showToast('Result deleted.'); await loadResults(currentStudentId); }
    else showToast(json.error || 'Failed to delete', 'error');
  } catch { showToast('Error deleting result', 'error'); }
}
