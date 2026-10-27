const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!require('fs').existsSync(envPath)) return;
  for (const line of require('fs').readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !Object.prototype.hasOwnProperty.call(process.env, match[1])) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}
loadEnv();
const { initDB, setAfterSave } = require('./db/database');
const { scheduleSync } = require('./services/googleSheets');
setAfterSave(scheduleSync);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production.');
}
if (isProduction) app.set('trust proxy', 1);

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'development-only-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax', secure: isProduction }
}));

app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware for /api routes (except login/logout/me)
app.use('/api', (req, res, next) => {
  if (['/login', '/logout', '/me'].includes(req.path)) return next();
  if (!req.session.user) return res.status(401).json({ success: false, error: 'Not authenticated' });
  next();
});

// Routes
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/dashboard'));
app.use('/api', require('./routes/students'));
app.use('/api', require('./routes/academics'));
app.use('/api', require('./routes/seminars'));
app.use('/api', require('./routes/reports'));
app.use('/api', require('./routes/sync'));

// Redirect root to login
app.get('/', (req, res) => res.redirect('/login.html'));

// Initialize DB then start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log('');
    console.log('🎓 StudentPro is running!');
    console.log(`   URL  : http://localhost:${PORT}`);
    console.log(`   Login: admin / admin123`);
    console.log('');
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
