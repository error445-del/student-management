// student-detail.js - Student detail page logic

let studentId = null;
let sgpaChart = null;
let currentStudent = null;
let studentGaps = [];

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();

  const params = new URLSearchParams(window.location.search);
  studentId = params.get('id');
  if (!studentId) {
    window.location.href = '/students.html';
    return;
  }

  document.getElementById('edit-profile-btn').addEventListener('click', openProfileEditor);
  document.getElementById('profile-modal').addEventListener('click', event => {
    if (event.target.id === 'profile-modal') closeModal('profile-modal');
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // Sub-tab switching (Seminars / Activities)
  document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.subtab).classList.add('active');
    });
  });

  await loadStudentDetail();
});

async function loadStudentDetail() {
  try {
    // Fetch student info
    const res = await fetch(`/api/students/${studentId}`);
    const json = await res.json();
    if (!json.success) { showToast('Student not found', 'error'); window.location.href='/students.html'; return; }
    const s = json.data;
    currentStudent = s;

    // Profile header
    const initials = s.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('profile-avatar').textContent = initials;
    document.getElementById('profile-name').textContent = s.full_name;
    document.getElementById('profile-meta').textContent = `Roll No: ${s.roll_no} | Department: ${s.department}`;
    const statusEl = document.getElementById('profile-status');
    statusEl.textContent = s.status;
    statusEl.className = `badge badge-${s.status === 'Active' ? 'active' : 'inactive'}`;
    document.getElementById('profile-cgpa').textContent = s.cgpa !== null && s.cgpa !== undefined ? s.cgpa : '—';

    // Personal Info tab
    const infoGrid = document.getElementById('personal-info-grid');
    infoGrid.innerHTML = `
      <div class="info-section">
        <h4>Personal Information</h4>
        <div class="info-list">
          <div class="info-row"><span class="info-label">Full Name</span><span class="info-value">${s.full_name}</span></div>
          <div class="info-row"><span class="info-label">Roll Number</span><span class="info-value">${s.roll_no}</span></div>
          <div class="info-row"><span class="info-label">Date of Birth</span><span class="info-value">${formatDate(s.dob)}</span></div>
          <div class="info-row"><span class="info-label">Gender</span><span class="info-value">${s.gender || '-'}</span></div>
          <div class="info-row"><span class="info-label">Department</span><span class="info-value">${s.department}</span></div>
          <div class="info-row"><span class="info-label">Email</span><span class="info-value">${s.email || '-'}</span></div>
          <div class="info-row"><span class="info-label">Phone</span><span class="info-value">${s.phone || '-'}</span></div>
          <div class="info-row"><span class="info-label">Address</span><span class="info-value">${s.address || '-'}</span></div>
        </div>
      </div>
      <div class="info-section">
        <h4>Academic Background</h4>
        <div class="info-list">
          <div class="info-row"><span class="info-label">SSC %</span><span class="info-value">${s.ssc_percent !== null ? s.ssc_percent + ' %' : '-'}</span></div>
          <div class="info-row"><span class="info-label">HSC %</span><span class="info-value">${s.hsc_percent !== null ? s.hsc_percent + ' %' : '-'}</span></div>
          <div class="info-row"><span class="info-label">Diploma %</span><span class="info-value">${s.diploma_percent !== null ? s.diploma_percent + ' %' : 'N/A'}</span></div>
          <div class="info-row"><span class="info-label">Current Semester</span><span class="info-value">${s.current_semester || '-'}</span></div>
          <div class="info-row"><span class="info-label">CGPA</span><span class="info-value"><strong>${s.cgpa || '-'}</strong></span></div>
          <div class="info-row"><span class="info-label">Status</span><span class="info-value"><span class="badge badge-${s.status === 'Active' ? 'active' : 'inactive'}">${s.status}</span></span></div>
        </div>
      </div>
    `;

    // Load all tabs data
    await loadGaps();
    await Promise.all([loadSemesterResults(), loadSeminarsAndActivities()]);

  } catch (err) {
    console.error(err);
    showToast('Error loading student data', 'error');
  }
}

function openProfileEditor() {
  if (!currentStudent) return;
  const fields = {
    'p-roll-no': 'roll_no', 'p-full-name': 'full_name', 'p-dob': 'dob', 'p-gender': 'gender',
    'p-department': 'department', 'p-status': 'status', 'p-email': 'email', 'p-phone': 'phone',
    'p-address': 'address', 'p-ssc': 'ssc_percent', 'p-hsc': 'hsc_percent', 'p-diploma': 'diploma_percent'
  };
  Object.entries(fields).forEach(([id, key]) => {
    document.getElementById(id).value = currentStudent[key] ?? '';
  });
  openModal('profile-modal');
}

async function saveProfile() {
  const value = id => document.getElementById(id).value.trim();
  const payload = {
    roll_no: value('p-roll-no'), full_name: value('p-full-name'), department: value('p-department'),
    dob: value('p-dob') || null, gender: value('p-gender') || null, status: value('p-status'),
    email: value('p-email') || null, phone: value('p-phone') || null, address: value('p-address') || null,
    ssc_percent: value('p-ssc') === '' ? null : Number(value('p-ssc')),
    hsc_percent: value('p-hsc') === '' ? null : Number(value('p-hsc')),
    diploma_percent: value('p-diploma') === '' ? null : Number(value('p-diploma'))
  };
  if (!payload.roll_no || !payload.full_name || !payload.department) {
    showToast('Roll No, Full Name, and Department are required', 'error'); return;
  }
  const button = document.getElementById('save-profile-btn');
  button.disabled = true;
  try {
    const response = await fetch(`/api/students/${studentId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!result.success) { showToast(result.error || 'Failed to update profile', 'error'); return; }
    closeModal('profile-modal');
    showToast('Student profile updated');
    await loadStudentDetail();
  } catch { showToast('Error updating profile', 'error'); }
  finally { button.disabled = false; }
}

async function loadSemesterResults() {
  try {
    const res = await fetch(`/api/semester-results/${studentId}`);
    const json = await res.json();
    if (!json.success) return;

    const grouped = json.data;
    const container = document.getElementById('semester-results-container');

    if (!grouped || grouped.length === 0) {
      container.innerHTML = '<p class="loading-cell">No semester results recorded.</p>';
      return;
    }

    // Build SGPA trend data
    const sgpaData = grouped.map(g => ({ semester: g.semester, sgpa: g.sgpa, cgpa: g.cgpa }));
    const gapSemesters = new Set(studentGaps.filter(g => g.semester).map(g => Number(g.semester)));

    // Build SGPA chart
    const chartCanvas = document.getElementById('sgpa-detail-chart');
    if (sgpaChart) sgpaChart.destroy();
    sgpaChart = new Chart(chartCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: sgpaData.map(d => 'Sem ' + d.semester),
        datasets: [{
          label: 'SGPA',
          data: sgpaData.map(d => d.sgpa),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: sgpaData.map(d => gapSemesters.has(d.semester) ? '#dc2626' : '#2563eb'),
          pointStyle: sgpaData.map(d => gapSemesters.has(d.semester) ? 'triangle' : 'circle'),
          pointRadius: 5
        }, {
          label: 'CGPA', data: sgpaData.map(d => d.cgpa), borderColor: '#f97316',
          backgroundColor: 'transparent', fill: false, tension: 0.3, pointRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        scales: { y: { min: 0, max: 10 } }
      }
    });

    // Build results table
    container.innerHTML = grouped.map(g => `
      <div class="sem-block">
        <div class="sem-header">
          <span>Semester ${g.semester}</span>
          <span class="sgpa-pill">SGPA: ${g.sgpa} · CGPA: ${g.cgpa}</span>
        </div>
        <table class="data-table">
          <thead><tr><th>Component</th><th>Code</th><th>Subject Name</th><th>Marks</th><th>Grade</th></tr></thead>
          <tbody>
            ${g.subjects.map(sub => `
              <tr>
                <td>${sub.component_type}</td>
                <td>${sub.subject_code}</td>
                <td>${sub.subject_name}</td>
                <td>${sub.marks}</td>
                <td><span class="grade-badge">${sub.grade}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('');

  } catch (err) {
    console.error('Error loading semester results:', err);
  }
}

async function loadSeminarsAndActivities() {
  try {
    const [semRes, actRes] = await Promise.all([
      fetch(`/api/seminars/${studentId}`),
      fetch(`/api/activities/${studentId}`)
    ]);
    const semJson = await semRes.json();
    const actJson = await actRes.json();

    const semTbody = document.getElementById('seminars-detail-tbody');
    if (semJson.success && semJson.data.length > 0) {
      semTbody.innerHTML = semJson.data.map(s => `
        <tr>
          <td>${formatDate(s.date)}</td>
          <td>${s.title}</td>
          <td>${s.organized_by || '-'}</td>
          <td>${s.scope || 'Internal'}</td>
          <td><span class="type-badge">${s.type || '-'}</span></td>
        </tr>
      `).join('');
    } else {
      semTbody.innerHTML = '<tr><td colspan="5" class="loading-cell">No seminars recorded.</td></tr>';
    }

    const actTbody = document.getElementById('activities-detail-tbody');
    if (actJson.success && actJson.data.length > 0) {
      actTbody.innerHTML = actJson.data.map(a => `
        <tr>
          <td>${formatDate(a.date)}</td>
          <td>${a.activity_name}</td>
          <td>${a.portfolio_group || 'Extra-curricular'}</td>
          <td>${a.category || '-'}</td>
          <td>${a.description || '-'}</td>
        </tr>
      `).join('');
    } else {
      actTbody.innerHTML = '<tr><td colspan="5" class="loading-cell">No activities recorded.</td></tr>';
    }
  } catch (err) {
    console.error('Error loading seminars/activities:', err);
  }
}

async function loadGaps() {
  try {
    const res = await fetch(`/api/academic-gaps/${studentId}`);
    const json = await res.json();
    const tbody = document.getElementById('gaps-detail-tbody');
    studentGaps = json.success ? json.data : [];
    const dropYears = studentGaps.filter(g => g.gap_type === 'Drop Year');
    const dropIndicator = document.getElementById('drop-year-indicator');
    if (dropYears.length) {
      dropIndicator.style.display = 'flex';
      document.getElementById('drop-year-summary').textContent = dropYears.map(g =>
        `${formatDate(g.start_date)} – ${formatDate(g.end_date)}`).join(', ');
    } else dropIndicator.style.display = 'none';
    if (json.success && json.data.length > 0) {
      tbody.innerHTML = json.data.map(g => `
        <tr>
          <td><span class="badge ${g.gap_type === 'Drop Year' ? 'badge-inactive' : ''}">${g.gap_type || 'Academic Gap'}</span></td>
          <td>${g.semester ? 'Semester ' + g.semester : '-'}</td>
          <td>${g.start_date || g.end_date ? `${formatDate(g.start_date)} – ${formatDate(g.end_date)}` : '-'}</td>
          <td>${g.description}</td>
          <td>${formatDate(g.identified_date)}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">No academic gaps recorded.</td></tr>';
    }
  } catch (err) {
    console.error('Error loading gaps:', err);
  }
}
