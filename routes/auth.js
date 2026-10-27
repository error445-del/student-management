const express = require('express');
const bcrypt = require('bcryptjs');
const { get, run } = require('../db/database');
const router = express.Router();

// POST /api/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.json({ success: false, error: 'Username and password required' });

    const admin = get('SELECT * FROM admin WHERE username = ?', [username]);
    if (!admin) return res.json({ success: false, error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, admin.password);
    if (!valid) return res.json({ success: false, error: 'Invalid credentials' });

    req.session.user = { id: admin.id, username: admin.username };
    res.json({ success: true, data: { username: admin.username } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// GET /api/me
router.get('/me', (req, res) => {
  if (!req.session.user) return res.json({ success: false, error: 'Not authenticated' });
  res.json({ success: true, data: req.session.user });
});

// POST /api/change-password
router.post('/change-password', (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.json({ success: false, error: 'Both passwords required' });

    const admin = get('SELECT * FROM admin WHERE id = ?', [req.session.user.id]);
    if (!admin) return res.json({ success: false, error: 'Admin not found' });

    if (!bcrypt.compareSync(currentPassword, admin.password))
      return res.json({ success: false, error: 'Current password is incorrect' });

    const hash = bcrypt.hashSync(newPassword, 10);
    run('UPDATE admin SET password = ? WHERE id = ?', [hash, admin.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
