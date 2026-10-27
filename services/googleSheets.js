const { google } = require('googleapis');
const { all } = require('../db/database');
const fs = require('node:fs');

const TABS = ['Students', 'SemesterResults', 'AcademicGaps', 'Seminars', 'Activities'];
let authClientPromise;
let syncTimer;
let syncQueue = Promise.resolve();

function serviceAccountCredentials() {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (encoded) {
    try { return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')); } catch { return null; }
  }
  if (json) {
    try { return JSON.parse(json); } catch { return null; }
  }
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath || !fs.existsSync(keyPath)) return null;
  try { return JSON.parse(fs.readFileSync(keyPath, 'utf8')); } catch { return null; }
}

function isConfigured() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const credentials = serviceAccountCredentials();
  const credentialsAvailable = Boolean(credentials?.client_email && credentials?.private_key);
  return Boolean(sheetId && !sheetId.startsWith('configure-this-') && credentialsAvailable &&
    ((process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_JSON) || (keyPath && fs.existsSync(keyPath))));
}

async function getSheets() {
  if (!isConfigured()) throw new Error('Google Sheets sync is inactive. Set GOOGLE_APPLICATION_CREDENTIALS and GOOGLE_SHEET_ID in .env.');
  if (!authClientPromise) {
    const authOptions = {
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    };
    const credentials = serviceAccountCredentials();
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      authOptions.credentials = credentials;
    } else {
      authOptions.keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    const auth = new google.auth.GoogleAuth(authOptions);
    authClientPromise = auth.getClient().then(authClient => google.sheets({ version: 'v4', auth: authClient }));
  }
  return authClientPromise;
}

async function ensureTabs(sheets) {
  const response = await sheets.spreadsheets.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    fields: 'sheets.properties.title'
  });
  const present = new Set((response.data.sheets || []).map(item => item.properties.title));
  const requests = TABS.filter(title => !present.has(title)).map(title => ({ addSheet: { properties: { title } } }));
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      requestBody: { requests }
    });
  }
}

function rowsByTab() {
  return {
    Students: [
      ['Student ID', 'Roll No', 'Full Name', 'Department', 'Status'],
      ...all('SELECT id,roll_no,full_name,department,status FROM students ORDER BY roll_no').map(Object.values)
    ],
    SemesterResults: [
      ['Result ID', 'Student ID', 'Roll No', 'Semester', 'Subject Code', 'Subject Name', 'Component', 'Marks', 'Grade'],
      ...all(`SELECT r.id,r.student_id,st.roll_no,sub.semester,sub.subject_code,sub.subject_name,sub.component_type,r.marks,r.grade
        FROM student_subject_results r JOIN subjects sub ON sub.id=r.subject_id JOIN students st ON st.id=r.student_id
        ORDER BY st.roll_no,sub.semester,sub.component_type,sub.subject_code`).map(Object.values)
    ],
    AcademicGaps: [
      ['Gap ID', 'Student ID', 'Roll No', 'Record Type', 'Semester', 'Start Date', 'End Date', 'Description', 'Identified Date'],
      ...all(`SELECT g.id,g.student_id,st.roll_no,g.gap_type,g.semester,g.start_date,g.end_date,g.description,g.identified_date
        FROM academic_gaps g JOIN students st ON st.id=g.student_id ORDER BY st.roll_no,g.start_date`).map(Object.values)
    ],
    Seminars: [
      ['Seminar ID', 'Student ID', 'Roll No', 'Date', 'Title', 'Organized By', 'Scope', 'Type'],
      ...all(`SELECT x.id,x.student_id,st.roll_no,x.date,x.title,x.organized_by,x.scope,x.type
        FROM seminars x JOIN students st ON st.id=x.student_id ORDER BY st.roll_no,x.date`).map(Object.values)
    ],
    Activities: [
      ['Activity ID', 'Student ID', 'Roll No', 'Date', 'Activity', 'Portfolio Group', 'Category', 'Description'],
      ...all(`SELECT a.id,a.student_id,st.roll_no,a.date,a.activity_name,a.portfolio_group,a.category,a.description
        FROM activities a JOIN students st ON st.id=a.student_id ORDER BY st.roll_no,a.date`).map(Object.values)
    ]
  };
}

async function syncSpreadsheet() {
  try {
    const sheets = await getSheets();
    await ensureTabs(sheets);
    const tabs = rowsByTab();
    const existingLengths = await Promise.all(TABS.map(async name => {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: `${name}!A:Z`
      });
      return [name, (response.data.values || []).length];
    }));
    const data = Object.entries(tabs).map(([name, rows]) => ({
      range: `${name}!A1`, majorDimension: 'ROWS',
      values: rows.map(row => row.map(value => value === null || value === undefined ? '' : value))
    }));
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      valueInputOption: 'RAW',
      requestBody: { data }
    });
    const clearRanges = existingLengths.flatMap(([name, oldLength]) => {
      const newLength = tabs[name].length;
      return oldLength > newLength ? [`${name}!A${newLength + 1}:Z${oldLength}`] : [];
    });
    if (clearRanges.length) {
      await sheets.spreadsheets.values.batchClear({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        requestBody: { ranges: clearRanges }
      });
    }
    return { tabs: TABS, rowCounts: Object.fromEntries(Object.entries(tabs).map(([name, rows]) => [name, rows.length - 1])) };
  } catch (error) {
    // A failed token exchange can leave a rejected credential client cached. Rebuild it on retry.
    authClientPromise = undefined;
    const details = [error.message, error.response?.data?.error, error.response?.data?.error_description]
      .filter(Boolean).join(' ');
    if (/invalid_grant|invalid jwt|invalid signature/i.test(details)) {
      throw new Error('Google rejected the service-account JWT signature. Create a fresh JSON key for the configured service account, confirm the credential file path and system clock, share the spreadsheet with that service-account email, then restart the server.');
    }
    throw error;
  }
}

function enqueueSync() {
  syncQueue = syncQueue.catch(() => undefined).then(syncSpreadsheet);
  return syncQueue;
}

function scheduleSync() {
  if (!isConfigured()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    enqueueSync().catch(error => console.error('Google Sheets background sync failed:', error.message));
  }, 1000);
}

function syncNow() {
  clearTimeout(syncTimer);
  return enqueueSync();
}

module.exports = { isConfigured, scheduleSync, syncNow };
