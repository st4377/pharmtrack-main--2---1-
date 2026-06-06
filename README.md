 PharmTrack

> **Your intelligent pharmaceutical companion** — safer medicines, smarter alternatives, and help when it matters most.

PharmTrack is a full-stack web application built to make medication management accessible, safe, and intelligent. It combines a Node.js/Express backend, a Python ML microservice, and a Supabase-powered database to deliver a comprehensive health platform — from scanning a medicine's QR code to finding a cheaper alternative in seconds, to locating the nearest hospital in an emergency.

---

## ✨ Feature Overview

| Feature | Description |
|---|---|
| 🔍 Alternative Medicine Finder | AI-powered cosine similarity search for cheaper/equivalent drugs |
| 🚨 Emergency Response | One-tap GPS-based hospital and ambulance locator |
| 💊 Medicine QR Generator | Encode medicine details into scannable QR codes |
| 📋 Prescription Manager | Upload and manage prescriptions via cloud storage |
| ⏰ Smart Reminders | Scheduled email/SMS medicine reminders |
| 🛡️ Safety Information | Drug safety lookup and adverse event reporting |
| 👤 Google OAuth | Seamless one-click login with Google |
| 🔧 Admin Dashboard | Full user and hospital data management panel |
| ♿ Accessibility Page | Inclusive design for all users |
| 🌍 SDG Alignment | UN Sustainable Development Goals awareness |

---

## 🔍 Alternative Medicine Recommendation — Core Feature

> **Find cheaper, equivalent medicines in milliseconds using machine learning.**

This is the intellectual core of PharmTrack. When a patient cannot afford a branded drug, or when a medicine is out of stock, PharmTrack instantly surfaces clinically equivalent alternatives ranked by similarity and price.

### How It Works

The system runs as a dedicated **Flask microservice** (`cosine_api.py`) on port 5000, proxied through the main Node.js server. At startup, it:

1. **Loads** a curated `alternative_medicine.csv` dataset containing medicine brand names, chemical compositions, dosage forms, and prices.
2. **Vectorises** every medicine entry using **TF-IDF** (Term Frequency–Inverse Document Frequency) with unigram + bigram analysis — meaning compound terms like `"paracetamol 500mg"` are correctly weighted.
3. **Builds a similarity matrix** once in memory so that every subsequent query is just a fast transform + dot product — no re-computation per request.

When a user searches for a medicine:

```
User types: "crocin"
          ↓
TF-IDF transforms the query into a vector
          ↓
Cosine similarity scored against all ~N medicines in the dataset
          ↓
Ranked top-10 returned: paracetamol, dolo, calpol, etc.
Sorted by: highest similarity first → cheapest price on tie
```

### Why Cosine Similarity?

Cosine similarity measures the **angle between two text vectors**, not their magnitude — so a short medicine name and a long description can still match perfectly if they share the right chemical terms. This is far superior to simple keyword matching, which would miss synonyms, partial names, or multi-word compositions.

### Node.js Fallback

A second implementation lives in `server_api_route.js` — a pure JavaScript cosine similarity engine using a hand-built TF-IDF vocabulary, serving as a fallback if the Python microservice is unavailable. Both engines read from the same `alternative_medicine.csv` dataset.

### Dataset

The dataset (`backend/dataset/alternative_medicine.csv`) contains fields:
- `brand` — trade/brand name
- `name` — generic/INN name
- `chemical_composition` — active ingredient(s) with dosage
- `form` — tablet, syrup, capsule, injection, etc.
- `price` — MRP for cost-comparison ranking

### API Endpoint

```
GET /api/cosine-alternatives?med=<query>
```

Returns a JSON array of up to 10 alternatives, each with brand, generic name, composition, form, price, and a cosine similarity score (0–1).

---

## 🚨 Emergency Response — Life-Critical Feature

> **One tap to find help. One tap to call an ambulance.**

The Emergency Module (`frontend/emergency/emergency.html`) is designed to work fast under stress, with zero friction between a user and potentially life-saving information.

### What It Does

On opening the Emergency page, the app:

1. **Instantly requests GPS coordinates** via the browser's Geolocation API (`navigator.geolocation`).
2. **Reverse-geocodes** the coordinates using the OpenStreetMap Nominatim API to display a human-readable address.
3. Presents **four one-tap map buttons** that deep-link directly into Google Maps search, anchored to the user's live location:
   - 🏥 Hospitals near me
   - 💊 Pharmacies near me
   - 🏨 Clinics near me
   - 🕐 24-hour medical stores

4. A **direct `tel:108` ambulance button** — India's national emergency ambulance number — is pinned at the bottom, always visible.
5. A **Poison Control hotline** button (`tel:18001116117`) for toxicological emergencies.
6. Falls back gracefully to an **approximate location** if GPS is denied, displaying a clear warning banner rather than breaking silently.

### Backend Hospital Management

Hospitals are also managed server-side via `backend/routes/hospitals.js` — a full CRUD REST API (`GET / POST / PUT / DELETE`) over a `hospitals.json` store, allowing administrators to maintain a curated local directory of verified facilities.

### Design Philosophy

The emergency page uses a dark high-contrast theme, large tap targets, and minimal chrome — deliberately stripped of anything that adds friction when seconds matter.

---

## 📋 Prescription Manager

Users can securely upload prescription images or PDFs directly from the app:

- Files are stored in **Supabase Storage** (`prescriptionsupload` bucket)
- Metadata (filename, notes, upload time, user email) is saved to the **Supabase `prescriptions` table**
- Users can retrieve their full prescription history filtered by email
- File size is capped at 5MB via Multer middleware

**API routes:**
```
POST /api/prescription/upload   — upload a prescription file
GET  /api/prescription/my       — fetch all prescriptions for a user
```

---

## ⏰ Smart Medicine Reminders

The notification service (`backend/services/notificationService.js`) runs a **cron job every minute** using `node-cron`. It:

- Checks the Supabase `reminders` table for any active reminders matching the current `HH:MM` time and day of the week
- Sends a **formatted email** via Resend with medicine name, dosage, and time
- Sends an **SMS** via Twilio to the user's registered phone number
- Supports per-reminder toggles for email and SMS independently

Reminders are managed via a REST API:
```
GET    /api/reminders           — fetch reminders for logged-in user
POST   /api/reminders           — create a new reminder
DELETE /api/reminders/:id       — delete a reminder
PATCH  /api/reminders/:id/toggle — enable or disable a reminder
```

---

## 💊 Medicine QR Code Generator

The QR Generator tool (`frontend/qr-generator.html`) encodes four fields into a QR code:

- Medicine name
- Manufacturer
- Batch number / expiry
- Any additional notes

Generated QR codes can be **downloaded** and later scanned via the Safety page to instantly verify a medicine's authenticity and details.

---

## 🔐 Authentication

PharmTrack uses **Google OAuth 2.0** via Passport.js. On login:

- User profile (name, email, photo) is stored in `users.json` locally and synced to Supabase's `users` table
- Login counts and timestamps are tracked
- Sessions are managed server-side with `express-session` (secure cookies in production)

---

## 🛠️ Tech Stack

### Backend
- **Node.js + Express 5** — main application server (port 3000)
- **Python + Flask** — ML microservice for cosine similarity (port 5000)
- **Passport.js** — Google OAuth 2.0 authentication
- **Multer** — multipart file upload handling
- **node-cron** — scheduled reminder jobs
- **http-proxy-middleware** — proxies `/api/cosine-alternatives` to Flask

### Database & Storage
- **Supabase** — PostgreSQL database for users, prescriptions, reminders
- **Supabase Storage** — file storage for prescription uploads

### ML / Data
- **scikit-learn** — TfidfVectorizer + cosine_similarity
- **NumPy** — vector operations
- **CSV dataset** — `alternative_medicine.csv` (~27KB, curated medicine entries)

### Notifications
- **Resend** — transactional email delivery
- **Twilio** — SMS notifications

### Frontend
- Vanilla HTML/CSS/JavaScript
- Supabase JS client for client-side auth queries

---

## 📁 Project Structure

```
pharmtrack/
├── cosine_api.py                   # Flask ML microservice (TF-IDF cosine similarity)
├── alternative_medicine.csv        # Medicine dataset (root-level copy)
│
├── backend/
│   ├── server.js                   # Main Express server, OAuth, sessions
│   ├── server_api_route.js         # JS-based cosine similarity fallback + CSV parser
│   ├── users.json                  # Local user store
│   ├── dataset/
│   │   └── alternative_medicine.csv  # Primary medicine dataset
│   ├── routes/
│   │   ├── hospitals.js            # Hospital CRUD API
│   │   ├── prescription.js         # Prescription upload/fetch API
│   │   └── reminders.js            # Reminder CRUD + toggle API
│   └── services/
│       └── notificationService.js  # Cron-based email/SMS reminder scheduler
│
└── frontend/
    ├── index.html                  # Landing page
    ├── auth.html                   # Login page
    ├── qr-generator.html           # QR code generator tool
    ├── css/
    │   └── base.css
    ├── js/
    │   ├── main.js
    │   └── supabaseClient.js
    ├── emergency/
    │   ├── emergency.html          # GPS emergency response page
    │   └── hospitals.json          # Local hospital directory
    └── pages/
        ├── alternatives.html       # Alternative medicine finder UI
        ├── prescriptions.html      # Prescription manager UI
        ├── reminders.html          # Reminder manager UI
        ├── safety.html             # Drug safety + QR scanner
        ├── admin.html              # Admin dashboard
        ├── features.html           # Feature overview
        ├── problem.html            # Problem/adverse event reporting
        ├── accessibility.html      # Accessibility info
        └── sdg.html                # UN SDG alignment page
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js v14 or higher
- Python 3.8 or higher
- A Supabase project (free tier works)
- Google Cloud Console project with OAuth 2.0 credentials

### 1. Clone and install dependencies

```bash
git clone https://github.com/st4377/pharmatrack.git
cd pharmatrack
npm install
```

### 2. Install Python dependencies

```bash
pip install flask flask-cors scikit-learn numpy
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# App
BASE_URL=http://localhost:3000
SESSION_SECRET=your-session-secret
NODE_ENV=development

# Flask microservice URL
FLASK_API_URL=http://localhost:5000

# Notifications (optional)
RESEND_API_KEY=your-resend-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

### 4. Set up Supabase tables

Create the following tables in your Supabase project:

```sql
-- Users table
create table users (
  id uuid default gen_random_uuid() primary key,
  name text, email text, google_id text unique,
  photo text, login_count int default 1,
  first_login timestamptz, last_login timestamptz
);

-- Prescriptions table
create table prescriptions (
  id uuid default gen_random_uuid() primary key,
  email text, file_name text, stored_name text,
  file_url text, notes text, uploaded_at timestamptz
);

-- Reminders table
create table reminders (
  id uuid default gen_random_uuid() primary key,
  user_email text, user_phone text,
  medicine_name text, dosage text,
  reminder_time text, days_of_week text[],
  notify_email boolean default true,
  notify_sms boolean default false,
  is_active boolean default true
);
```

Also create a **Storage bucket** named `prescriptionsupload` (public).

### 5. Start the servers

In two separate terminals:

```bash
# Terminal 1 — Node.js server
node backend/server.js

# Terminal 2 — Python ML microservice
python cosine_api.py
```

### 6. Open in browser

```
http://localhost:3000
```

---

## 🌍 SDG Alignment

PharmTrack directly supports several UN Sustainable Development Goals:

- **SDG 3 — Good Health and Well-Being:** Improving access to medicines and safety information
- **SDG 10 — Reduced Inequalities:** Making expensive branded drugs replaceable with affordable equivalents
- **SDG 11 — Sustainable Cities:** Emergency response tools for urban and rural health access

---

## 📄 License

This project is for educational purposes. See repository for full terms.

---

## 🔗 Links

- **Repository:** https://github.com/st4377/pharmatrack
- **Issues:** https://github.com/st4377/pharmatrack/issues
