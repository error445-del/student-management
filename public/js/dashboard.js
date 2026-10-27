// Dashboard overview logic
document.addEventListener('DOMContentLoaded', async () => {
  if (!await checkAuth()) return;
  loadDashboard();
});

function escapeDashboardText(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard/stats');
    const json = await res.json();
    if (!json.success) { showToast('Failed to load dashboard', 'error'); return; }
    const data = json.data;
    document.getElementById('stat-students').textContent = data.total_students;
    document.getElementById('stat-semesters').textContent = data.total_semesters_recorded;
    document.getElementById('stat-seminars').textContent = data.total_seminars;
    document.getElementById('stat-activities').textContent = data.total_activities;
    if (typeof Chart === 'undefined') throw new Error('Charts could not be loaded. Check your internet connection and reload the page.');

    new Chart(document.getElementById('deptChart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: (data.students_per_dept || []).map(d => d.dept),
        datasets: [{ label: 'Students', data: (data.students_per_dept || []).map(d => d.count),
          backgroundColor: ['#6477e8','#47b992','#e8a34e','#d779a3','#8a70ce','#55a9c3'],
          borderRadius: 7, borderSkipped: false }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { displayColors: false, padding: 10, cornerRadius: 8 } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, color: '#8792a5' }, grid: { color: '#f0f2f6', drawBorder: false } },
          x: { ticks: { color: '#68758a' }, grid: { display: false }, border: { display: false } }
        }
      }
    });

    new Chart(document.getElementById('sgpaChart').getContext('2d'), {
      type: 'line',
      data: {
        labels: (data.avg_sgpa_trend || []).map(s => 'Sem ' + s.semester),
        datasets: [{ label: 'Average SGPA', data: (data.avg_sgpa_trend || []).map(s => s.avg_sgpa),
          borderColor: '#6477e8', backgroundColor: 'rgba(100,119,232,0.10)', fill: true,
          tension: 0.35, pointBackgroundColor: '#fff', pointBorderColor: '#6477e8',
          pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { displayColors: false, padding: 10, cornerRadius: 8 } },
        scales: {
          y: { min: 0, max: 10, ticks: { color: '#8792a5' }, grid: { color: '#f0f2f6', drawBorder: false } },
          x: { ticks: { color: '#68758a' }, grid: { display: false }, border: { display: false } }
        },
        interaction: { intersect: false, mode: 'index' }
      }
    });

    const tbody = document.getElementById('recent-students-tbody');
    if (!data.recent_students || data.recent_students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">No student records yet. Add a student to get started.</td></tr>';
      return;
    }
    tbody.innerHTML = data.recent_students.map(s => {
      const name = escapeDashboardText(s.full_name);
      const status = escapeDashboardText(s.status);
      return `<tr>
        <td class="student-name-cell"><strong>${name}</strong><small>${escapeDashboardText(s.roll_no)}</small></td>
        <td>${escapeDashboardText(s.department)}</td>
        <td>${escapeDashboardText(s.current_semester || '-')}</td>
        <td>${s.last_sgpa !== null && s.last_sgpa !== undefined ? escapeDashboardText(s.last_sgpa) : '-'}</td>
        <td><span class="badge badge-${s.status === 'Active' ? 'active' : 'inactive'}">${status}</span></td>
        <td><a class="student-view-link" title="View student" aria-label="View ${name}" href="/student-detail.html?id=${encodeURIComponent(s.id)}">&#8599;</a></td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Error loading dashboard data', 'error');
  }
}
