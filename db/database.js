const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs-extra');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'ledger.db');

let _db = null;
let afterSave = null;

// Save DB to disk
function saveDB() {
  const data = _db.export();
  fs.outputFileSync(DB_PATH, Buffer.from(data));
  if (afterSave) {
    try { afterSave(); } catch (error) { console.error('Post-save sync scheduling failed:', error.message); }
  }
}

function setAfterSave(callback) { afterSave = callback; }

// Get db instance (synchronous after init)
function getDB() {
  if (!_db) throw new Error('Database not initialized yet');
  return _db;
}

// Promisified helpers (work synchronously with sql.js)
function run(sql, params = []) {
  const db = getDB();
  try {
    db.run(sql, params);
    saveDB();
    return { lastID: db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0] || null, changes: 1 };
  } catch (err) {
    throw err;
  }
}

function get(sql, params = []) {
  const db = getDB();
  const result = db.exec(sql, params);
  if (!result.length || !result[0].values.length) return null;
  const cols = result[0].columns;
  const vals = result[0].values[0];
  const obj = {};
  cols.forEach((c, i) => obj[c] = vals[i]);
  return obj;
}

function all(sql, params = []) {
  const db = getDB();
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map(vals => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = vals[i]);
    return obj;
  });
}

function tableExists(name) {
  return !!get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [name]);
}

// Initialize database
async function initDB() {
  await fs.ensureDir(DATA_DIR);
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
    _db.run('PRAGMA foreign_keys = ON');
    console.log('Loaded existing DB from', DB_PATH);
    migrateExistingDatabase();
    saveDB();
  } else {
    _db = new SQL.Database();
    console.log('Created new DB at', DB_PATH);
    createSchema();
    await seedData();
    saveDB();
    console.log('Database initialized and seeded.');
  }
}

function createSchema() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  _db.run(schema);
}

function tableColumns(tableName) {
  return _db.exec(`PRAGMA table_info(${tableName})`)[0]?.values.map(row => row[1]) || [];
}

function addColumnIfMissing(tableName, columnName, definition) {
  const columns = tableColumns(tableName);
  if (columns.length && !columns.includes(columnName)) {
    _db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

// Migrations only add structures and copy valid rows; legacy records stay intact.
function migrateExistingDatabase() {
  addColumnIfMissing('seminars', 'scope', "TEXT NOT NULL DEFAULT 'Internal' CHECK (scope IN ('Internal', 'External'))");
  addColumnIfMissing('activities', 'portfolio_group', "TEXT NOT NULL DEFAULT 'Extra-curricular' CHECK (portfolio_group IN ('Technical', 'Co-curricular', 'Extra-curricular'))");
  addColumnIfMissing('academic_gaps', 'gap_type', "TEXT NOT NULL DEFAULT 'Academic Gap' CHECK (gap_type IN ('Academic Gap', 'Drop Year'))");
  addColumnIfMissing('academic_gaps', 'start_date', 'TEXT');
  addColumnIfMissing('academic_gaps', 'end_date', 'TEXT');
  createSchema();
  _db.run("UPDATE activities SET portfolio_group='Technical' WHERE lower(category)='technical'");
  _db.run("UPDATE activities SET portfolio_group='Co-curricular' WHERE lower(category) IN ('cultural','social')");

  const legacyColumns = tableColumns('semester_results');
  if (legacyColumns.includes('subject_code') && legacyColumns.includes('subject_name')) {
    _db.run(`CREATE TRIGGER IF NOT EXISTS cascade_legacy_semester_results
      AFTER DELETE ON students BEGIN DELETE FROM semester_results WHERE student_id=OLD.id; END`);
    _db.run(`INSERT OR IGNORE INTO subjects (department, semester, subject_code, subject_name, component_type)
      SELECT DISTINCT s.department, r.semester, r.subject_code, r.subject_name, 'Theory'
      FROM semester_results r JOIN students s ON s.id = r.student_id
      WHERE r.semester BETWEEN 1 AND 8 AND r.subject_code IS NOT NULL AND r.subject_name IS NOT NULL`);
    _db.run(`INSERT OR IGNORE INTO student_subject_results (student_id, subject_id, marks, grade)
      SELECT r.student_id, sub.id, r.marks, r.grade
      FROM semester_results r
      JOIN students s ON s.id = r.student_id
      JOIN subjects sub ON sub.department = s.department AND sub.semester = r.semester
        AND sub.subject_code = r.subject_code AND sub.subject_name = r.subject_name
        AND sub.component_type = 'Theory'
      WHERE r.marks BETWEEN 0 AND 100`);
  }
  _db.run('PRAGMA foreign_keys = ON');
}

async function seedData() {
  // Admin
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'admin123');
  if (!password) throw new Error('Set ADMIN_PASSWORD before starting a production deployment with a new database.');
  const hash = bcrypt.hashSync(password, 10);
  _db.run('INSERT INTO admin (username, password) VALUES (?, ?)', [username, hash]);

  // Students
  const students = [
    ['01','Aarav Patil','2005-06-12','Male','ECE','aaravpatil@example.com','9876543210','Virar, Maharashtra',93.20,89.60,null,'Active'],
    ['02','Sneha Sharma','2004-11-25','Female','ECE','snehasharma@example.com','9123456780','Pune, Maharashtra',88.40,85.20,null,'Active'],
    ['03','Rahul Mehta','2005-03-08','Male','ECE','rahulmehta@example.com','9234567891','Nashik, Maharashtra',91.00,87.50,null,'Active'],
    ['04','Priya Gupta','2004-07-19','Female','CSE','priyagupta@example.com','9345678902','Mumbai, Maharashtra',95.60,92.80,null,'Active'],
    ['05','Kunal Verma','2005-01-30','Male','CSE','kunalverma@example.com','9456789013','Thane, Maharashtra',89.20,86.40,null,'Active'],
    ['06','Ananya Singh','2004-09-14','Female','CSE','ananyasingh@example.com','9567890124','Nagpur, Maharashtra',92.80,90.00,null,'Active'],
    ['07','Rohan Desai','2005-05-22','Male','ME','rohandesai@example.com','9678901235','Aurangabad, Maharashtra',86.00,82.40,null,'Active'],
    ['08','Kavya Nair','2004-12-05','Female','ME','kavyanair@example.com','9789012346','Kolhapur, Maharashtra',84.60,80.20,null,'Active'],
    ['09','Vivek Joshi','2005-08-17','Male','EE','vivekjoshi@example.com','9890123457','Solapur, Maharashtra',90.40,88.00,null,'Active'],
    ['10','Meera Pillai','2004-04-28','Female','IT','meerapillai@example.com','9901234568','Satara, Maharashtra',87.80,84.60,null,'Active']
  ];
  for (const s of students) {
    _db.run(`INSERT INTO students (roll_no,full_name,dob,gender,department,email,phone,address,ssc_percent,hsc_percent,diploma_percent,status)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, s);
  }

  // Semester results per department
  const eceSubs = {
    1:[['EC101','Basic Electronics',78],['EC102','Mathematics-I',82],['EC103','Programming',75],['EC104','Communication Skills',88],['EC105','Workshop Practice',80]],
    2:[['EC201','Circuit Theory',85],['EC202','Mathematics-II',79],['EC203','Digital Electronics',92],['EC204','Physics',77],['EC205','Engineering Drawing',83]],
    3:[['EC301','Signals & Systems',88],['EC302','Electronic Devices',75],['EC303','Data Structures',82],['EC304','Electromagnetics',70],['EC305','Microprocessors',86]],
    4:[['EC401','VLSI Design',80],['EC402','Embedded Systems',84],['EC403','Control Systems',76],['EC404','Digital Communication',88],['EC405','Project Work',90]]
  };
  const cseSubs = {
    1:[['CS101','Programming Fundamentals',90],['CS102','Mathematics-I',85],['CS103','Digital Logic',78],['CS104','Communication Skills',88],['CS105','Lab Practice',92]],
    2:[['CS201','Data Structures',88],['CS202','Mathematics-II',82],['CS203','Computer Organization',75],['CS204','OOP Concepts',91],['CS205','DBMS',87]],
    3:[['CS301','Algorithms',85],['CS302','Operating Systems',79],['CS303','Computer Networks',82],['CS304','Software Engineering',88],['CS305','Web Technologies',90]],
    4:[['CS401','Machine Learning',82],['CS402','Cloud Computing',85],['CS403','Mobile App Dev',88],['CS404','Cyber Security',76],['CS405','Project Work',92]]
  };
  const meSubs = {
    1:[['ME101','Engineering Mechanics',72],['ME102','Mathematics-I',68],['ME103','Thermodynamics',75],['ME104','Workshop',80],['ME105','Engineering Drawing',77]],
    2:[['ME201','Fluid Mechanics',70],['ME202','Strength of Materials',74],['ME203','Mathematics-II',66],['ME204','Manufacturing',78],['ME205','Machine Design',72]],
    3:[['ME301','Heat Transfer',75],['ME302','Dynamics',68],['ME303','CAD/CAM',80],['ME304','Refrigeration',72],['ME305','Industrial Engineering',76]]
  };
  const eeSubs = {
    1:[['EE101','Electrical Basics',80],['EE102','Mathematics-I',75],['EE103','Circuit Theory',82],['EE104','Lab Practice',78],['EE105','Physics',70]],
    2:[['EE201','Electrical Machines',78],['EE202','Power Systems',82],['EE203','Mathematics-II',74],['EE204','Electronics',80],['EE205','Instrumentation',76]],
    3:[['EE301','Control Systems',82],['EE302','Power Electronics',78],['EE303','Digital Systems',85],['EE304','Microcontrollers',80],['EE305','Project',88]]
  };
  const itSubs = {
    1:[['IT101','Programming Basics',85],['IT102','Mathematics-I',78],['IT103','Networking Basics',82],['IT104','Communication Skills',80],['IT105','Lab Practice',88]],
    2:[['IT201','Data Structures',82],['IT202','DBMS',88],['IT203','Mathematics-II',76],['IT204','Web Dev Basics',90],['IT205','OOP',84]],
    3:[['IT301','Computer Networks',85],['IT302','Software Engineering',80],['IT303','Cloud Basics',88],['IT304','Cyber Security',76],['IT305','Project Work',90]]
  };

  function gradeOf(m) {
    if (m >= 90) return 'O'; if (m >= 80) return 'A'; if (m >= 70) return 'B+'; if (m >= 60) return 'B'; return 'C';
  }
  function insertOneResult(sid, department, semester, code, name, marks, componentType = 'Theory') {
    _db.run('INSERT OR IGNORE INTO subjects (department,semester,subject_code,subject_name,component_type) VALUES (?,?,?,?,?)',
      [department, semester, code, name, componentType]);
    const subjectId = _db.exec('SELECT id FROM subjects WHERE department=? AND semester=? AND subject_code=? AND component_type=?',
      [department, semester, code, componentType])[0].values[0][0];
    _db.run('INSERT OR IGNORE INTO student_subject_results (student_id,subject_id,marks,grade) VALUES (?,?,?,?)',
      [sid, subjectId, marks, gradeOf(marks)]);
  }

  function insertResults(sid, department, subMap, semCount) {
    for (let sem = 1; sem <= semCount; sem++) {
      if (!subMap[sem]) continue;
      for (const [code, name, marks] of subMap[sem]) {
        insertOneResult(sid, department, sem, code, name, marks);
      }
    }
  }

  // ECE: id 1=4 sems, 2=3 sems, 3=3 sems
  insertResults(1, 'ECE', eceSubs, 4); insertResults(2, 'ECE', eceSubs, 3); insertResults(3, 'ECE', eceSubs, 3);
  // CSE: id 4=4 sems, 5=3 sems, 6=3 sems
  insertResults(4, 'CSE', cseSubs, 4); insertResults(5, 'CSE', cseSubs, 3); insertResults(6, 'CSE', cseSubs, 3);
  // ME: id 7=3 sems, 8=2 sems
  insertResults(7, 'ME', meSubs, 3); insertResults(8, 'ME', meSubs, 2);
  // EE: id 9=3 sems
  insertResults(9, 'EE', eeSubs, 3);
  // IT: id 10=3 sems
  insertResults(10, 'IT', itSubs, 3);

  insertOneResult(1, 'ECE', 1, 'EC106L', 'Electronics Practical', 91, 'Lab');
  insertOneResult(4, 'CSE', 1, 'CS106L', 'Programming Lab', 94, 'Lab');

  // Seminars & Activities
  _db.run('INSERT INTO seminars (student_id,date,title,organized_by,type,scope) VALUES (?,?,?,?,?,?)', [1,'2024-08-12','Artificial Intelligence','VIVA Institute','Technical','Internal']);
  _db.run('INSERT INTO seminars (student_id,date,title,organized_by,type,scope) VALUES (?,?,?,?,?,?)', [1,'2024-02-05','Renewable Energy','IEEE','Technical','External']);
  _db.run('INSERT INTO seminars (student_id,date,title,organized_by,type,scope) VALUES (?,?,?,?,?,?)', [1,'2023-09-18','Career Guidance','Training & Placement','Non-Technical','Internal']);
  _db.run('INSERT INTO seminars (student_id,date,title,organized_by,type,scope) VALUES (?,?,?,?,?,?)', [4,'2024-07-20','Cloud Computing','AWS','Technical','External']);
  _db.run('INSERT INTO seminars (student_id,date,title,organized_by,type,scope) VALUES (?,?,?,?,?,?)', [4,'2024-01-15','Cybersecurity Awareness','ISACA','Technical','External']);

  _db.run('INSERT INTO activities (student_id,date,activity_name,category,description,portfolio_group) VALUES (?,?,?,?,?,?)', [1,'2024-01-26','Cultural Fest','Cultural','Participated in group dance','Co-curricular']);
  _db.run('INSERT INTO activities (student_id,date,activity_name,category,description,portfolio_group) VALUES (?,?,?,?,?,?)', [1,'2023-08-15','Sports Event','Sports','Won inter-department match','Extra-curricular']);
  _db.run('INSERT INTO activities (student_id,date,activity_name,category,description,portfolio_group) VALUES (?,?,?,?,?,?)', [1,'2024-09-10','NSS Activity','Social','Community service program','Co-curricular']);
  _db.run('INSERT INTO activities (student_id,date,activity_name,category,description,portfolio_group) VALUES (?,?,?,?,?,?)', [4,'2024-03-22','Hackathon','Technical','Won 2nd prize in college hackathon','Technical']);

  _db.run('INSERT INTO academic_gaps (student_id,semester,description,identified_date,gap_type,start_date,end_date) VALUES (?,?,?,?,?,?,?)', [1,2,'Weak in Mathematics-II, needs extra practice','2024-01-10','Academic Gap',null,null]);
  _db.run('INSERT INTO academic_gaps (student_id,semester,description,identified_date,gap_type,start_date,end_date) VALUES (?,?,?,?,?,?,?)', [5,null,'One-year academic interruption','2023-12-05','Drop Year','2022-06-01','2023-05-31']);
}

module.exports = { initDB, run, get, all, saveDB, setAfterSave, tableExists };
