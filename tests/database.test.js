const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const initSqlJs = require('sql.js');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studentpro-db-test-'));
process.env.DB_PATH = path.join(tempDir, 'ledger.db');
const database = require('../db/database');

before(async () => {
  const SQL = await initSqlJs();
  const legacy = new SQL.Database();
  legacy.run(`
    CREATE TABLE admin (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
    CREATE TABLE students (id INTEGER PRIMARY KEY, roll_no TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL, department TEXT NOT NULL,
      ssc_percent REAL, hsc_percent REAL, diploma_percent REAL, status TEXT DEFAULT 'Active');
    CREATE TABLE semester_results (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, semester INTEGER NOT NULL,
      subject_code TEXT NOT NULL, subject_name TEXT NOT NULL, marks INTEGER, grade TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id));
    CREATE TABLE academic_gaps (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, semester INTEGER, description TEXT NOT NULL, identified_date TEXT);
    CREATE TABLE seminars (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, date TEXT, title TEXT NOT NULL, organized_by TEXT, type TEXT);
    CREATE TABLE activities (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, date TEXT, activity_name TEXT NOT NULL, category TEXT, description TEXT);
  `);
  legacy.run("INSERT INTO students (id,roll_no,full_name,department) VALUES (1,'LEGACY-01','Legacy Student','CSE')");
  legacy.run("INSERT INTO semester_results (id,student_id,semester,subject_code,subject_name,marks,grade) VALUES (1,1,1,'CS101','Programming',87,'A')");
  legacy.run("INSERT INTO academic_gaps (id,student_id,semester,description) VALUES (1,1,1,'Legacy gap')");
  fs.writeFileSync(process.env.DB_PATH, Buffer.from(legacy.export()));
  legacy.close();
  await database.initDB();
});
after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

test('initializes all documented tables from schema.sql', () => {
  const tables = database.all("SELECT name FROM sqlite_master WHERE type='table'").map(row => row.name);
  for (const name of ['admin', 'students', 'subjects', 'student_subject_results', 'academic_gaps', 'seminars', 'activities']) {
    assert.ok(tables.includes(name), `missing table ${name}`);
  }
});

test('migrates legacy results without deleting the original records', () => {
  const migrated = database.get(`SELECT st.subject_code, r.marks, st.component_type
    FROM student_subject_results r JOIN subjects st ON st.id=r.subject_id WHERE r.student_id=?`, [1]);
  assert.deepEqual(migrated, { subject_code: 'CS101', marks: 87, component_type: 'Theory' });
  assert.equal(database.get('SELECT subject_code FROM semester_results WHERE id=?', [1]).subject_code, 'CS101');
});

test('supports parameterized student writes and reads', () => {
  const result = database.run(
    'INSERT INTO students (roll_no, full_name, department) VALUES (?, ?, ?)',
    ['TEST-01', "O'Connor", 'CSE']
  );
  assert.ok(result.lastID);
  assert.equal(database.get('SELECT full_name FROM students WHERE id=?', [result.lastID]).full_name, "O'Connor");
});

test('enforces unique student roll numbers', () => {
  database.run('INSERT INTO students (roll_no, full_name, department) VALUES (?, ?, ?)', ['UNIQUE-01', 'First', 'IT']);
  assert.throws(() => database.run(
    'INSERT INTO students (roll_no, full_name, department) VALUES (?, ?, ?)',
    ['UNIQUE-01', 'Duplicate', 'IT']
  ));
});

test('rejects invalid percentages and marks at the database boundary', () => {
  assert.throws(() => database.run(
    'INSERT INTO students (roll_no, full_name, department, ssc_percent) VALUES (?, ?, ?, ?)',
    ['BAD-PERCENT', 'Invalid Percent', 'IT', 101]
  ));
  const student = database.run('INSERT INTO students (roll_no, full_name, department) VALUES (?, ?, ?)',
    ['MARK-CHECK', 'Marks Check', 'CSE']);
  const subject = database.run('INSERT INTO subjects (department, semester, subject_code, subject_name, component_type) VALUES (?, ?, ?, ?, ?)',
    ['CSE', 1, 'TEST101', 'Test Subject', 'Theory']);
  assert.throws(() => database.run(
    'INSERT INTO student_subject_results (student_id, subject_id, marks) VALUES (?, ?, ?)',
    [student.lastID, subject.lastID, 101]
  ));
});

test('cascades student deletion to related records', () => {
  const { lastID } = database.run('INSERT INTO students (roll_no, full_name, department) VALUES (?, ?, ?)', ['CASCADE-01', 'Cascade', 'CSE']);
  database.run('INSERT INTO academic_gaps (student_id, description) VALUES (?, ?)', [lastID, 'Test gap']);
  database.run('DELETE FROM students WHERE id=?', [lastID]);
  assert.equal(database.get('SELECT id FROM academic_gaps WHERE student_id=?', [lastID]), null);
});
