# 🎓 StudentPro — Student Academic Record Management System

> A comprehensive web-based system to manage student academic profiles, semester results, seminars, co-curricular activities, and academic gap analysis.

---

## 🛠️ Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Runtime     | Node.js                           |
| Framework   | Express.js                        |
| Database    | SQLite (via sql.js)               |
| Auth        | express-session + bcryptjs        |
| Frontend    | HTML5 / CSS3 / Vanilla JavaScript |
| Charts      | Chart.js                          |
| Export      | CSV (server-generated)            |

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js >= 18.x installed

### Installation

```bash
# 1. Navigate to the project directory
cd c:\Users\hp\Downloads\dbms

# 2. Install dependencies
npm install

# 3. Create local configuration (PowerShell)
Copy-Item .env.example .env
# Edit .env and replace SESSION_SECRET with a long random value

# 4. Start the server
npm start

# For development with auto-reload
npm run dev
```

### Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

### Default Login Credentials

| Field    | Value      |
|----------|------------|
| Username | `admin`    |
| Password | `admin123` |

> **Note:** The database is seeded automatically on first run with 10 sample students across 5 departments (ECE, CSE, ME, EE, IT), semester results, seminars, activities, and academic gap records.

The database schema is in `schema.sql`. The default database file is `data/ledger.db`; set `DB_PATH` to override it. `PORT` and `SESSION_SECRET` can also be set in `.env` or the process environment. The app reads `.env` without an additional package. The database uses sql.js and writes the exported SQLite file to disk after updates.

Run the database test suite with `npm test`. It checks fresh schema initialization, parameterized reads and writes, roll-number uniqueness, and deletion cascades.

---

## ✨ Features

- **🔐 Secure Admin Authentication** — Session-based login with bcrypt password hashing
- **📋 Student Management** — Full CRUD for student profiles including personal info and educational background
- **📊 Semester Result Tracking** — Add/edit/delete subject marks per semester; automatic SGPA & CGPA computation
- **📈 Dashboard Analytics** — Live stats: total students, department-wise counts, SGPA trend charts
- **🎤 Seminar Records** — Log technical and non-technical seminars attended by students
- **🏆 Activity Tracking** — Record co-curricular and extra-curricular activities
- **⚠️ Academic Gap Analysis** — Identify and document academic weaknesses per student per semester
- **🔍 Search** — Real-time search by student name or roll number
- **📥 CSV Export** — Download full student academic report as a CSV file
- **Google Sheets Sync** — Automatically replace configured sheet tabs after database writes; manual sync is also available on Reports
- **📱 Responsive Design** — Works on desktop and tablet screens

---

## 📁 Project Structure

```
dbms/
├── server.js                  # Express app entry point
├── package.json               # Project dependencies
├── .gitignore
├── README.md
│
├── db/
│   └── database.js            # SQLite init, schema creation, seed data
├── schema.sql                 # Normalized schema and database constraints
│
├── routes/
│   ├── auth.js                # Login, logout, session check
│   ├── dashboard.js           # Stats & analytics endpoints
│   ├── students.js            # Student CRUD + search
│   ├── academics.js           # Semester results & academic gaps
│   ├── seminars.js            # Seminars & activities
│   ├── reports.js             # Progress report & CSV export
│   └── sync.js                # Authenticated Google Sheets sync endpoint
├── services/
│   └── googleSheets.js        # Full one-way export to five spreadsheet tabs
│
├── public/                    # Frontend static files
│   ├── login.html
│   ├── dashboard.html
│   ├── students.html
│   ├── student-detail.html
│   └── assets/
│       ├── css/
│       └── js/
│
└── data/                      # Auto-created; holds ledger.db (gitignored)
    └── ledger.db
```

---

## Database Structure and Record Updates

`schema.sql` is the source of truth for new databases. Students are stored separately from subjects, semester result records, academic gaps, seminars, and activities. `subjects` stores department, semester, code, name, and whether the component is theory or lab. `student_subject_results` stores each student's marks against a subject.

The schema enforces unique roll numbers and subject keys, marks from 0 to 100, semester values from 1 to 8, valid status and portfolio categories, and foreign keys that cascade student deletions to related records. The API repeats validation and returns an error response when a submitted value is invalid. SGPA and CGPA are derived from marks as a simple average divided by ten; the implementation does not apply course credit weights.

To make a direct SQL change, stop the server first so its in-memory SQLite copy cannot overwrite external edits. Open `data/ledger.db` with a SQLite editor, update the relevant table, save, close the editor, then start the server again. Result rows reference `subjects.id` through `student_subject_results.subject_id`, so add or select the matching subject before inserting a result. Prefer the GUI for everyday CRUD operations.

Older `data/ledger.db` files are migrated additively on startup. The original `semester_results` table is retained, while valid historical rows are copied into the normalized subject/result tables. The original rows remain available for recovery.

## Google Sheets Setup

The Sheet can be created after installing the project. First enable the Google Sheets API and create a service account in Google Cloud. Create a new key and store it outside this project. Share the target spreadsheet with the service account email as an Editor; the app creates these tabs and their headers on the first sync: `Students`, `SemesterResults`, `AcademicGaps`, `Seminars`, and `Activities`.

Add the following settings to `.env`, using your key file path and the spreadsheet ID from its URL:

```env
GOOGLE_APPLICATION_CREDENTIALS=C:\private\studentpro-service-account.json
GOOGLE_SHEET_ID=your_spreadsheet_id
```

For hosting platforms that cannot mount a credential file, set `GOOGLE_SERVICE_ACCOUNT_JSON` to the full service-account JSON, or set `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` to its Base64-encoded contents. Keep the credential in the host's secret/environment-variable settings; never commit it to the repository. Set `GOOGLE_SHEET_ID` as a separate variable.

Restart the server. After that, GUI changes are exported automatically, and **Reports → Sync Now** runs an immediate export. Each sync replaces the rows in the five tabs with the current SQLite records; edits made in Sheets are not imported into the app. Direct SQL changes should be made with the server stopped; after saving the database, restart the server to load and export those changes. The export includes roll number, name, department, status, results, gaps, seminars, and activities. It excludes date of birth, email, phone, and address.

See Google's [service account and file sharing guide](https://developers.google.com/workspace/guides/create-credentials) and [Sheets values guide](https://developers.google.com/workspace/sheets/api/guides/values). If the service-account key previously stored in this project was exposed, revoke it and create a replacement before using sync.

If sync reports `invalid_grant: Invalid JWT Signature`, Google is rejecting the private key's signature. Create a new JSON key for the service account in Google Cloud, replace the configured credential (including the hosting secret if deployed), confirm the machine clock is correct, share the spreadsheet with the service account's `client_email` as an Editor, and restart the app. A key that has been revoked or does not match its service account cannot be repaired by the app.

## Hosting

This is a Node.js web app. Use a host that supports a persistent disk because the SQLite database is written to disk after changes.

1. Create a Node web service from this repository. Set the build command to `npm install` and the start command to `npm start`.
2. Add a persistent disk and set `DB_PATH` to a file on its mount, for example `/var/data/ledger.db`. Keep that disk mounted between deploys or the database will be recreated.
3. Set `NODE_ENV=production`, `SESSION_SECRET` to a long random value, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` before the first start. The admin credentials are used only when a new database is seeded; existing databases keep their current login. The default `admin` / `admin123` is for local development only.
4. For Google Sheets, set `GOOGLE_SHEET_ID` and a service-account JSON secret using one of the environment variables above. Share the sheet with that service account email.
5. The host should pass its assigned `PORT` environment variable to the app. Use `/healthz` for the service health check.

The app serves its frontend and API from the same service. HTTPS and proxy-aware secure session cookies are enabled when `NODE_ENV=production`.

## 🔌 API Endpoints

| Method | Endpoint                              | Description                     |
|--------|---------------------------------------|---------------------------------|
| POST   | `/api/login`                          | Admin login                     |
| GET    | `/api/logout`                         | Logout                          |
| GET    | `/api/me`                             | Current session info            |
| GET    | `/api/dashboard/stats`                | Dashboard statistics            |
| GET    | `/api/students`                       | List all students               |
| GET    | `/api/students/search?q=`             | Search students                 |
| GET    | `/api/students/:id`                   | Get student detail              |
| POST   | `/api/students`                       | Add new student                 |
| PUT    | `/api/students/:id`                   | Update student                  |
| DELETE | `/api/students/:id`                   | Delete student                  |
| GET    | `/api/semester-results/:student_id`   | All results grouped by semester |
| POST   | `/api/semester-results`               | Add result entry                |
| PUT    | `/api/semester-results/:id`           | Update result                   |
| DELETE | `/api/semester-results/:id`           | Delete result                   |
| GET    | `/api/subject-marks/:student_id/:sem` | Results for a specific semester |
| GET    | `/api/academic-gaps/:student_id`      | Academic gaps for a student     |
| POST   | `/api/academic-gaps`                  | Add academic gap                |
| PUT    | `/api/academic-gaps/:id`              | Update academic gap             |
| DELETE | `/api/academic-gaps/:id`              | Delete academic gap             |
| GET    | `/api/seminars/:student_id`           | Seminars for a student          |
| POST   | `/api/seminars`                       | Add seminar                     |
| PUT    | `/api/seminars/:id`                   | Update seminar                  |
| DELETE | `/api/seminars/:id`                   | Delete seminar                  |
| GET    | `/api/activities/:student_id`         | Activities for a student        |
| POST   | `/api/activities`                     | Add activity                    |
| PUT    | `/api/activities/:id`                 | Update activity                 |
| DELETE | `/api/activities/:id`                 | Delete activity                 |
| GET    | `/api/reports/progress`               | Department-wise progress report |
| GET    | `/api/reports/export-csv`             | Download CSV report             |
| GET    | `/api/sync/google-sheets/status`      | Check whether Sheets sync is configured |
| POST   | `/api/sync/google-sheets`             | Export all current records to Sheets |

---

## 🔮 Future Enhancements

- **Validated two-way Sheets sync** — Import spreadsheet edits only after field and conflict validation
- **PDF Report Generation** — Per-student printable academic report cards
- **Role-Based Access** — Faculty and student login levels with different permissions
- **Email Notifications** — Automated alerts for academic gaps and low SGPA
- **Attendance Tracking** — Semester-wise attendance records per subject

---

## 📄 License

MIT License — Free to use for educational purposes.
