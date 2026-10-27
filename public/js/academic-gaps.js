// academic-gaps.js - Academic Gaps page logic

let currentStudentId = null;
let gapsById = new Map();

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadStudentsDropdown();

  document.getElementById('student-select').addEventListener('change', async (e) => {
    currentStudentId = e.target.value;
    if (currentStudentId) {
      document.getElementById('add-gap-btn').style.display = 'inline-flex';
      document.getElementById('gaps-section').style.display = 'block';
      document.getElementById('no-student-msg').style.display = 'none';
      await loadGaps();
    } else {
      document.getElementById('add-gap-btn').style.display = 'none';
      document.getElementById('gaps-section').style.display = 'none';
      document.getElementById('no-student-msg').style.display = 'flex';
    }
  });

  document.getElementById('add-gap-btn').addEventListener('click', () => {
    document.getElementById('gap-modal-title').textContent = 'Add Academic Gap';
    document.getElementById('gap-id').value = '';
    document.getElementById('g-semester').value = '';
    document.getElementById('g-description').value = '';
    document.getElementById('g-date').value = '';
    document.getElementById('g-type').value = 'Academic Gap';
    document.getElementById('g-start-date').value = '';
    document.getElementById('g-end-date').value = '';
    openModal('gap-modal');
  });

  document.getElementById('save-gap-btn').addEventListener('click', saveGap);

  document.getElementById('gap-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('gap-modal')) closeModal('gap-modal');
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

async function loadGaps() {
  try {
    const res = await fetch(`/api/academic-gaps/${currentStudentId}`);
    const json = await res.json();
    const tbody = document.getElementById('gaps-tbody');
    if (!json.success || json.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">No academic gaps recorded for this student.</td></tr>';
      return;
    }
    gapsById = new Map(json.data.map(g => [String(g.id), g]));
    tbody.innerHTML = json.data.map(g => `
      <tr>
        <td><span class="badge ${g.gap_type === 'Drop Year' ? 'badge-inactive' : ''}">${g.gap_type || 'Academic Gap'}</span></td>
        <td>${g.semester ? 'Semester ' + g.semester : '-'}</td>
        <td>${g.start_date || g.end_date ? `${formatDate(g.start_date)} – ${formatDate(g.end_date)}` : '-'}</td>
        <td>${g.description}</td>
        <td>${formatDate(g.identified_date)}</td>
        <td class="action-btns">
          <button class="btn-icon" title="Edit" data-action="edit-gap" data-id="${g.id}">✏️</button>
          <button class="btn-icon btn-icon-danger" title="Delete" data-action="delete-gap" data-id="${g.id}">🗑</button>
        </td>
      </tr>
    `).join('');
  } catch { showToast('Error loading gaps', 'error'); }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action][data-id]');
  if (!button) return;
  const gap = gapsById.get(button.dataset.id);
  if (button.dataset.action === 'edit-gap' && gap) editGap(gap);
  if (button.dataset.action === 'delete-gap') deleteGap(Number(button.dataset.id));
});

function editGap(gap) {
  document.getElementById('gap-modal-title').textContent = 'Edit Academic Gap';
  document.getElementById('gap-id').value = gap.id;
  document.getElementById('g-semester').value = gap.semester || '';
  document.getElementById('g-description').value = gap.description;
  document.getElementById('g-date').value = gap.identified_date || '';
  document.getElementById('g-type').value = gap.gap_type || 'Academic Gap';
  document.getElementById('g-start-date').value = gap.start_date || '';
  document.getElementById('g-end-date').value = gap.end_date || '';
  openModal('gap-modal');
}

async function saveGap() {
  const id = document.getElementById('gap-id').value;
  const description = document.getElementById('g-description').value.trim();
  if (!description) { showToast('Description is required', 'error'); return; }

  const payload = {
    student_id: currentStudentId,
    semester: document.getElementById('g-semester').value || null,
    description,
    identified_date: document.getElementById('g-date').value || null,
    gap_type: document.getElementById('g-type').value,
    start_date: document.getElementById('g-start-date').value || null,
    end_date: document.getElementById('g-end-date').value || null
  };

  const btn = document.getElementById('save-gap-btn');
  btn.disabled = true;
  try {
    const url = id ? `/api/academic-gaps/${id}` : '/api/academic-gaps';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast(id ? 'Gap updated!' : 'Gap added!');
      closeModal('gap-modal');
      await loadGaps();
    } else showToast(json.error || 'Failed to save', 'error');
  } catch { showToast('Error saving gap', 'error'); }
  finally { btn.disabled = false; }
}

async function deleteGap(id) {
  if (!confirm('Delete this academic gap record?')) return;
  try {
    const res = await fetch(`/api/academic-gaps/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) { showToast('Gap deleted.'); await loadGaps(); }
    else showToast(json.error || 'Failed to delete', 'error');
  } catch { showToast('Error deleting', 'error'); }
}
