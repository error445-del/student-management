// students.js - Students page logic

let allStudents = [];

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadStudents();

  // Search
  document.getElementById('search-input').addEventListener('input', async (e) => {
    const q = e.target.value.trim();
    if (q.length === 0) {
      renderStudents(allStudents);
    } else if (q.length >= 1) {
      try {
        const res = await fetch(`/api/students/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (json.success) renderStudents(json.data);
      } catch { showToast('Search failed', 'error'); }
    }
  });

  // Add Student button
  document.getElementById('add-student-btn').addEventListener('click', () => {
    openAddModal();
  });

  // Save Student button
  document.getElementById('save-student-btn').addEventListener('click', () => {
    saveStudent();
  });

  // Close modal on overlay click
  document.getElementById('student-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('student-modal')) closeModal('student-modal');
  });
});

async function loadStudents() {
  try {
    const res = await fetch('/api/students');
    const json = await res.json();
    if (json.success) {
      allStudents = json.data;
      renderStudents(allStudents);
    } else {
      showToast('Failed to load students', 'error');
    }
  } catch {
    showToast('Error loading students', 'error');
  }
}

function renderStudents(students) {
  const tbody = document.getElementById('students-tbody');
  if (!students || students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">No students found.</td></tr>';
    return;
  }
  tbody.innerHTML = students.map(s => `
    <tr>
      <td><strong>${s.roll_no}</strong></td>
      <td>
        <div class="student-name-cell">
          <div class="avatar-sm">${getInitials(s.full_name)}</div>
          <span>${s.full_name}</span>
        </div>
      </td>
      <td>${s.department}</td>
      <td>${s.current_semester || '-'}</td>
      <td>${s.last_sgpa !== null && s.last_sgpa !== undefined ? s.last_sgpa : '-'}</td>
      <td><span class="badge badge-${s.status === 'Active' ? 'active' : 'inactive'}">${s.status}</span></td>
      <td class="action-btns">
        <button class="btn-icon" title="View" onclick="window.location='/student-detail.html?id=${s.id}'">👁</button>
        <button class="btn-icon" title="Edit" onclick="openEditModal(${s.id})">✏️</button>
        <button class="btn-icon btn-icon-danger" title="Delete" onclick="deleteStudent(${s.id}, '${s.full_name}')">🗑</button>
      </td>
    </tr>
  `).join('');
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function openAddModal() {
  document.getElementById('modal-title').textContent = 'Add New Student';
  document.getElementById('student-id').value = '';
  document.getElementById('student-form').reset();
  openModal('student-modal');
}

async function openEditModal(id) {
  try {
    const res = await fetch(`/api/students/${id}`);
    const json = await res.json();
    if (!json.success) { showToast('Failed to load student', 'error'); return; }
    const s = json.data;

    document.getElementById('modal-title').textContent = 'Edit Student';
    document.getElementById('student-id').value = s.id;
    document.getElementById('f-roll-no').value = s.roll_no || '';
    document.getElementById('f-full-name').value = s.full_name || '';
    document.getElementById('f-dob').value = s.dob || '';
    document.getElementById('f-gender').value = s.gender || '';
    document.getElementById('f-department').value = s.department || '';
    document.getElementById('f-status').value = s.status || 'Active';
    document.getElementById('f-email').value = s.email || '';
    document.getElementById('f-phone').value = s.phone || '';
    document.getElementById('f-address').value = s.address || '';
    document.getElementById('f-ssc').value = s.ssc_percent !== null ? s.ssc_percent : '';
    document.getElementById('f-hsc').value = s.hsc_percent !== null ? s.hsc_percent : '';
    document.getElementById('f-diploma').value = s.diploma_percent !== null ? s.diploma_percent : '';

    openModal('student-modal');
  } catch {
    showToast('Error loading student', 'error');
  }
}

async function saveStudent() {
  const id = document.getElementById('student-id').value;
  const rollNo = document.getElementById('f-roll-no').value.trim();
  const fullName = document.getElementById('f-full-name').value.trim();
  const department = document.getElementById('f-department').value;

  if (!rollNo || !fullName || !department) {
    showToast('Roll No, Full Name, and Department are required', 'error');
    return;
  }

  const payload = {
    roll_no: rollNo,
    full_name: fullName,
    dob: document.getElementById('f-dob').value || null,
    gender: document.getElementById('f-gender').value || null,
    department,
    status: document.getElementById('f-status').value,
    email: document.getElementById('f-email').value.trim() || null,
    phone: document.getElementById('f-phone').value.trim() || null,
    address: document.getElementById('f-address').value.trim() || null,
    ssc_percent: document.getElementById('f-ssc').value ? parseFloat(document.getElementById('f-ssc').value) : null,
    hsc_percent: document.getElementById('f-hsc').value ? parseFloat(document.getElementById('f-hsc').value) : null,
    diploma_percent: document.getElementById('f-diploma').value ? parseFloat(document.getElementById('f-diploma').value) : null
  };

  const btn = document.getElementById('save-student-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const url = id ? `/api/students/${id}` : '/api/students';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast(id ? 'Student updated!' : 'Student added!');
      closeModal('student-modal');
      await loadStudents();
    } else {
      showToast(json.error || 'Failed to save student', 'error');
    }
  } catch {
    showToast('Error saving student', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Student';
  }
}

async function deleteStudent(id, name) {
  if (!confirm(`Delete student "${name}"? This will also remove all their records.`)) return;
  try {
    const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('Student deleted.');
      await loadStudents();
    } else {
      showToast(json.error || 'Failed to delete', 'error');
    }
  } catch {
    showToast('Error deleting student', 'error');
  }
}
