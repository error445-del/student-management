PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roll_no TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  dob TEXT,
  gender TEXT,
  department TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  ssc_percent REAL CHECK (ssc_percent IS NULL OR ssc_percent BETWEEN 0 AND 100),
  hsc_percent REAL CHECK (hsc_percent IS NULL OR hsc_percent BETWEEN 0 AND 100),
  diploma_percent REAL CHECK (diploma_percent IS NULL OR diploma_percent BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department TEXT NOT NULL,
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  component_type TEXT NOT NULL CHECK (component_type IN ('Theory', 'Lab')),
  UNIQUE (department, semester, subject_code, component_type)
);

CREATE TABLE IF NOT EXISTS student_subject_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  marks INTEGER NOT NULL CHECK (marks >= 0 AND marks <= 100),
  grade TEXT CHECK (grade IS NULL OR grade IN ('O', 'A', 'B+', 'B', 'C', 'F')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE (student_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_results_student ON student_subject_results(student_id);
CREATE INDEX IF NOT EXISTS idx_subjects_department_semester ON subjects(department, semester);

CREATE TABLE IF NOT EXISTS academic_gaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  semester INTEGER,
  description TEXT NOT NULL,
  identified_date TEXT,
  gap_type TEXT NOT NULL DEFAULT 'Academic Gap' CHECK (gap_type IN ('Academic Gap', 'Drop Year')),
  start_date TEXT,
  end_date TEXT,
  CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS seminars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  date TEXT,
  title TEXT NOT NULL,
  organized_by TEXT,
  type TEXT,
  scope TEXT NOT NULL DEFAULT 'Internal' CHECK (scope IN ('Internal', 'External')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  date TEXT,
  activity_name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  portfolio_group TEXT NOT NULL DEFAULT 'Extra-curricular' CHECK (portfolio_group IN ('Technical', 'Co-curricular', 'Extra-curricular')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS validate_students_insert
BEFORE INSERT ON students
WHEN (NEW.ssc_percent IS NOT NULL AND NEW.ssc_percent NOT BETWEEN 0 AND 100)
  OR (NEW.hsc_percent IS NOT NULL AND NEW.hsc_percent NOT BETWEEN 0 AND 100)
  OR (NEW.diploma_percent IS NOT NULL AND NEW.diploma_percent NOT BETWEEN 0 AND 100)
  OR NEW.status IS NULL OR NEW.status NOT IN ('Active', 'Inactive')
BEGIN
  SELECT RAISE(ABORT, 'Student status and education percentages are invalid.');
END;

CREATE TRIGGER IF NOT EXISTS validate_students_update
BEFORE UPDATE OF ssc_percent, hsc_percent, diploma_percent, status ON students
WHEN (NEW.ssc_percent IS NOT NULL AND NEW.ssc_percent NOT BETWEEN 0 AND 100)
  OR (NEW.hsc_percent IS NOT NULL AND NEW.hsc_percent NOT BETWEEN 0 AND 100)
  OR (NEW.diploma_percent IS NOT NULL AND NEW.diploma_percent NOT BETWEEN 0 AND 100)
  OR NEW.status IS NULL OR NEW.status NOT IN ('Active', 'Inactive')
BEGIN
  SELECT RAISE(ABORT, 'Student status and education percentages are invalid.');
END;

CREATE TRIGGER IF NOT EXISTS validate_gaps_insert
BEFORE INSERT ON academic_gaps
WHEN (NEW.semester IS NOT NULL AND NEW.semester NOT BETWEEN 1 AND 8)
  OR (NEW.gap_type = 'Drop Year' AND (NEW.start_date IS NULL OR NEW.end_date IS NULL))
  OR (NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL AND NEW.end_date < NEW.start_date)
BEGIN
  SELECT RAISE(ABORT, 'Academic gap or drop-year values are invalid.');
END;

CREATE TRIGGER IF NOT EXISTS validate_gaps_update
BEFORE UPDATE OF semester, gap_type, start_date, end_date ON academic_gaps
WHEN (NEW.semester IS NOT NULL AND NEW.semester NOT BETWEEN 1 AND 8)
  OR (NEW.gap_type = 'Drop Year' AND (NEW.start_date IS NULL OR NEW.end_date IS NULL))
  OR (NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL AND NEW.end_date < NEW.start_date)
BEGIN
  SELECT RAISE(ABORT, 'Academic gap or drop-year values are invalid.');
END;

CREATE TRIGGER IF NOT EXISTS cascade_student_records
AFTER DELETE ON students
BEGIN
  DELETE FROM student_subject_results WHERE student_id = OLD.id;
  DELETE FROM academic_gaps WHERE student_id = OLD.id;
  DELETE FROM seminars WHERE student_id = OLD.id;
  DELETE FROM activities WHERE student_id = OLD.id;
END;
