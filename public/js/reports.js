// reports.js - Reports page logic

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadProgressReport();
  await loadGoogleSyncStatus();

  document.getElementById('export-csv-btn').addEventListener('click', () => {
    window.location.href = '/api/reports/export-csv';
  });
  document.getElementById('sync-google-sheets-btn').addEventListener('click', syncGoogleSheets);
});

async function loadGoogleSyncStatus() {
  const label = document.getElementById('google-sync-status');
  const button = document.getElementById('sync-google-sheets-btn');
  try {
    const response = await fetch('/api/sync/google-sheets/status');
    const result = await response.json();
    button.disabled = !result.configured;
    label.textContent = result.configured
      ? 'Connected. Changes made in the app are exported automatically; use Sync Now to export immediately.'
      : 'Sync is inactive. Configure a valid service-account key and spreadsheet ID in .env or your hosting environment, then restart the server.';
  } catch {
    label.textContent = 'Could not check Google Sheets configuration.';
  }
}

async function syncGoogleSheets() {
  const button = document.getElementById('sync-google-sheets-btn');
  const label = document.getElementById('google-sync-status');
  button.disabled = true;
  label.textContent = 'Exporting current records…';
  try {
    const response = await fetch('/api/sync/google-sheets', { method: 'POST' });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Export failed.');
    const counts = Object.entries(result.rowCounts).map(([tab, count]) => `${tab}: ${count}`).join(' · ');
    label.textContent = `Export complete. ${counts}`;
    showToast('Google Sheets export completed.');
  } catch (error) {
    label.textContent = `${error.message} You can update the credentials and retry.`;
    showToast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

async function loadProgressReport() {
  try {
    const res = await fetch('/api/reports/progress');
    const json = await res.json();
    const tbody = document.getElementById('progress-tbody');

    if (!json.success || !json.data || json.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">No data available.</td></tr>';
      return;
    }

    tbody.innerHTML = json.data.map(row => {
      const cgpa = parseFloat(row.average_latest_cgpa);
      let level = 'good';
      if (cgpa < 6.5) level = 'poor';
      else if (cgpa < 7.5) level = 'average';
      return `
        <tr>
          <td><strong>${row.department}</strong></td>
          <td>${row.student_count}</td>
          <td>
            <div class="cgpa-bar-row">
              <div class="cgpa-bar" style="width:${(cgpa/10)*100}%;background:${level==='good'?'#22c55e':level==='average'?'#f97316':'#ef4444'}"></div>
              <span>${cgpa.toFixed(2)}</span>
            </div>
          </td>
          <td><span class="badge badge-${level==='good'?'active':level==='average'?'warning':'inactive'}">${level==='good'?'Good':level==='average'?'Average':'Needs Improvement'}</span></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    showToast('Error loading report data', 'error');
  }
}
