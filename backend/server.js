require('dotenv').config();
const express  = require('express');
const session  = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const fs   = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { createProxyMiddleware } = require('http-proxy-middleware');
const multer = require('multer');

const app = express();

// ─────────────────────────────────────────────
// ✅ IMPORTANT FIX: TRUST PROXY (Render fix)
// ─────────────────────────────────────────────
app.set('trust proxy', 1);

// ── SUPABASE ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ── USERS FILE ──
const USERS_FILE = path.join(__dirname, 'users.json');

// ── MIDDLEWARE ──
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ─────────────────────────────────────────────
// ✅ SESSION FIX (Render compatible)
// ─────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// ── BASE URL ──
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ── GOOGLE AUTH ──
passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  `${BASE_URL}/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {

  const user = {
    name:      profile.displayName,
    email:     profile.emails[0].value,
    googleId:  profile.id,
    photo:     profile.photos?.[0]?.value || '',
    loginTime: new Date().toLocaleString()
  };

  // ── JSON STORAGE ──
  let users = [];
  if (fs.existsSync(USERS_FILE)) {
    try {
      users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch {
      users = [];
    }
  }

  const existingIndex = users.findIndex(u => u.googleId === user.googleId);

  if (existingIndex !== -1) {
    users[existingIndex].lastLogin  = user.loginTime;
    users[existingIndex].loginCount = (users[existingIndex].loginCount || 1) + 1;
  } else {
    user.loginCount = 1;
    users.push(user);
  }

  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('users.json error:', err.message);
  }

  // ── SUPABASE ──
  try {
    const { data: existing } = await supabase
      .from('users')
      .select('id, login_count')
      .eq('google_id', profile.id)
      .single();

    if (existing) {
      await supabase
        .from('users')
        .update({
          name: user.name,
          photo: user.photo,
          last_login: new Date().toISOString(),
          login_count: (existing.login_count || 1) + 1
        })
        .eq('google_id', profile.id);
    } else {
      await supabase
        .from('users')
        .insert([{
          name: user.name,
          email: user.email,
          google_id: profile.id,
          photo: user.photo,
          login_count: 1,
          first_login: new Date().toISOString(),
          last_login: new Date().toISOString()
        }]);
    }
  } catch (err) {
    console.warn('Supabase error:', err.message);
  }

  return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ─────────────────────────────────────────────
// ✅ STATIC FILES (FRONTEND)
// ─────────────────────────────────────────────
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// ─────────────────────────────────────────────
// ✅ ROOT FIX (IMPORTANT)
// ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ── AUTH ROUTES ──
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth.html' }),
  (req, res) => {
    const name  = encodeURIComponent(req.user.displayName || '');
    const photo = encodeURIComponent(req.user.photos?.[0]?.value || '');
    const email = encodeURIComponent(req.user.emails?.[0]?.value || '');
    res.redirect(`/index.html?loggedIn=true&name=${name}&photo=${photo}&email=${email}`);
  }
);

// ── API ──
app.get('/api/me', (req, res) => {
  res.json(req.isAuthenticated()
    ? { loggedIn: true, user: req.user }
    : { loggedIn: false });
});

// ── ROUTES ──
app.use('/api', require('./server_api_route'));
app.use('/api/hospitals', require('./routes/hospitals'));
app.use('/api/prescription', require('./routes/prescription'));

// ── FLASK PROXY ──
const FLASK_API_URL = process.env.FLASK_API_URL || 'http://localhost:5000';

app.use('/api/cosine-alternatives',
  createProxyMiddleware({
    target: FLASK_API_URL,
    changeOrigin: true,
  })
);

// ── MULTER ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});
app.locals.upload = upload;

// ─────────────────────────────────────────────
// ✅ SERVER START
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});