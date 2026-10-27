// seminars.js - Seminars & Activities page logic

let currentStudentId = null;
let seminarsById = new Map();
let activitiesById = new Map();
let seminarRows = [];
let activityRows = [];

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadStudentsDropdown();
  document.getElementById('seminar-scope-filter').addEventListener('change', renderSeminars);
  document.getElementById('activity-group-filter').addEventListener('change', renderActivities);

  document.getElementById('student-select').addEventListener('change', async (e) => {
    currentStudentId = e.target.value;
    if (currentStudentId) {
      document.getElementById('portfolio-section').style.display = 'block';
      document.getElementById('no-student-msg').style.display = 'none';
      await loadSeminars();
      await loadActivities();
    } else {
      document.getElementById('portfolio-section').style.display = 'none';
      document.getElementById('no-student-msg').style.display = 'flex';
    }
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // Add Seminar
  document.getElementById('add-seminar-btn').addEventListener('click', () => {
    document.getElementById('seminar-modal-title').textContent = 'Add Seminar';
    document.getElementById('seminar-id').value = '';
    document.getElementById('s-date').value = '';
    document.getElementById('s-title').value = '';
    document.getElementById('s-organized-by').value = '';
    document.getElementById('s-type').value = '';
    document.getElementById('s-scope').value = 'Internal';
    openModal('seminar-modal');
  });
  document.getElementById('save-seminar-btn').addEventListener('click', saveSeminar);
  document.getElementById('seminar-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('seminar-modal')) closeModal('seminar-modal');
  });

  // Add Activity
  document.getElementById('add-activity-btn').addEventListener('click', () => {
    document.getElementById('activity-modal-title').textContent = 'Add Activity';
    document.getElementById('activity-id').value = '';
    document.getElementById('a-date').value = '';
    document.getElementById('a-name').value = '';
    document.getElementById('a-category').value = '';
    document.getElementById('a-description').value = '';
    document.getElementById('a-portfolio-group').value = 'Extra-curricular';
    openModal('activity-modal');
  });
  document.getElementById('save-activity-btn').addEventListener('click', saveActivity);
  document.getElementById('activity-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('activity-modal')) closeModal('activity-modal');
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

async function loadSeminars() {
  try {
    const res = await fetch(`/api/seminars/${currentStudentId}`);
    const json = await res.json();
    seminarRows = json.success ? json.data : [];
    seminarsById = new Map(seminarRows.map(s => [String(s.id), s]));
    renderSeminars();
  } catch { showToast('Error loading seminars', 'error'); }
}

function renderSeminars() {
    const tbody = document.getElementById('seminars-tbody');
    const scope = document.getElementById('seminar-scope-filter').value;
    const rows = seminarRows.filter(s => !scope || s.scope === scope);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">No seminars match this filter.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(s => `
      <tr>
        <td>${formatDate(s.date)}</td>
        <td>${s.title}</td>
        <td>${s.organized_by || '-'}</td>
        <td>${s.scope || 'Internal'}</td>
        <td><span class="type-badge">${s.type || '-'}</span></td>
        <td class="action-btns">
          <button class="btn-icon" title="Edit" data-action="edit-seminar" data-id="${s.id}">✏️</button>
          <button class="btn-icon btn-icon-danger" title="Delete" data-action="delete-seminar" data-id="${s.id}">🗑</button>
        </td>
      </tr>
    `).join('');
}

async function loadActivities() {
  try {
    const res = await fetch(`/api/activities/${currentStudentId}`);
    const json = await res.json();
    activityRows = json.success ? json.data : [];
    activitiesById = new Map(activityRows.map(a => [String(a.id), a]));
    renderActivities();
  } catch { showToast('Error loading activities', 'error'); }
}

function renderActivities() {
    const tbody = document.getElementById('activities-tbody');
    const group = document.getElementById('activity-group-filter').value;
    const rows = activityRows.filter(a => !group || a.portfolio_group === group);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">No activities match this filter.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(a => `
      <tr>
        <td>${formatDate(a.date)}</td>
        <td>${a.activity_name}</td>
        <td>${a.portfolio_group || 'Extra-curricular'}</td>
        <td>${a.category || '-'}</td>
        <td>${a.description || '-'}</td>
        <td class="action-btns">
          <button class="btn-icon" title="Edit" data-action="edit-activity" data-id="${a.id}">✏️</button>
          <button class="btn-icon btn-icon-danger" title="Delete" data-action="delete-activity" data-id="${a.id}">🗑</button>
        </td>
      </tr>
    `).join('');
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action][data-id]');
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.action === 'edit-seminar') {
    const s = seminarsById.get(id); if (s) editSeminar(s.id, s.date || '', s.title, s.organized_by || '', s.type || '', s.scope || 'Internal');
  } else if (button.dataset.action === 'delete-seminar') deleteSeminar(Number(id));
  else if (button.dataset.action === 'edit-activity') {
    const a = activitiesById.get(id); if (a) editActivity(a.id, a.date || '', a.activity_name, a.category || '', a.description || '', a.portfolio_group || 'Extra-curricular');
  } else if (button.dataset.action === 'delete-activity') deleteActivity(Number(id));
});

function editSeminar(id, date, title, organizedBy, type, scope) {
  document.getElementById('seminar-modal-title').textContent = 'Edit Seminar';
  document.getElementById('seminar-id').value = id;
  document.getElementById('s-date').value = date;
  document.getElementById('s-title').value = title;
  document.getElementById('s-organized-by').value = organizedBy;
  document.getElementById('s-type').value = type;
  document.getElementById('s-scope').value = scope;
  openModal('seminar-modal');
}

async function saveSeminar() {
  const id = document.getElementById('seminar-id').value;
  const title = document.getElementById('s-title').value.trim();
  if (!title) { showToast('Title is required', 'error'); return; }

  const payload = {
    student_id: currentStudentId,
    date: document.getElementById('s-date').value || null,
    title,
    organized_by: document.getElementById('s-organized-by').value.trim() || null,
    type: document.getElementById('s-type').value || null,
    scope: document.getElementById('s-scope').value
  };

  const btn = document.getElementById('save-seminar-btn');
  btn.disabled = true;
  try {
    const url = id ? `/api/seminars/${id}` : '/api/seminars';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast(id ? 'Seminar updated!' : 'Seminar added!');
      closeModal('seminar-modal');
      await loadSeminars();
    } else showToast(json.error || 'Failed to save', 'error');
  } catch { showToast('Error saving seminar', 'error'); }
  finally { btn.disabled = false; }
}

async function deleteSeminar(id) {
  if (!confirm('Delete this seminar record?')) return;
  try {
    const res = await fetch(`/api/seminars/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) { showToast('Seminar deleted.'); await loadSeminars(); }
    else showToast(json.error || 'Failed to delete', 'error');
  } catch { showToast('Error deleting', 'error'); }
}

function editActivity(id, date, name, category, description, portfolioGroup) {
  document.getElementById('activity-modal-title').textContent = 'Edit Activity';
  document.getElementById('activity-id').value = id;
  document.getElementById('a-date').value = date;
  document.getElementById('a-name').value = name;
  document.getElementById('a-category').value = category;
  document.getElementById('a-description').value = description;
  document.getElementById('a-portfolio-group').value = portfolioGroup;
  openModal('activity-modal');
}

async function saveActivity() {
  const id = document.getElementById('activity-id').value;
  const name = document.getElementById('a-name').value.trim();
  if (!name) { showToast('Activity name is required', 'error'); return; }

  const payload = {
    student_id: currentStudentId,
    date: document.getElementById('a-date').value || null,
    activity_name: name,
    category: document.getElementById('a-category').value || null,
    description: document.getElementById('a-description').value.trim() || null,
    portfolio_group: document.getElementById('a-portfolio-group').value
  };

  const btn = document.getElementById('save-activity-btn');
  btn.disabled = true;
  try {
    const url = id ? `/api/activities/${id}` : '/api/activities';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast(id ? 'Activity updated!' : 'Activity added!');
      closeModal('activity-modal');
      await loadActivities();
    } else showToast(json.error || 'Failed to save', 'error');
  } catch { showToast('Error saving activity', 'error'); }
  finally { btn.disabled = false; }
}

async function deleteActivity(id) {
  if (!confirm('Delete this activity record?')) return;
  try {
    const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) { showToast('Activity deleted.'); await loadActivities(); }
    else showToast(json.error || 'Failed to delete', 'error');
  } catch { showToast('Error deleting', 'error'); }
}
