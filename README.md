# College Times / AKGEC Times 🚀

A modern, real-time campus social media and utility platform for students, faculty, and administration built with **React**, **TypeScript**, **Tailwind CSS**, and **Firebase (Auth, Firestore, Storage)**.

---

## 🌟 Features

- 📱 **Student Authentication**: Phone OTP login via Firebase Invisible reCAPTCHA and Google Sign-In.
- 📰 **Campus Feed & Scroll-Snap**: Real-time posts with categories (`General`, `Event`, `Mishap`, `LostFound`), optimistic like toggles, and real-time discussion drawer sheets.
- ⚡ **Infinite Scroll with Cursor Pagination**: Firestore `startAfter()` pagination with loading state indicator and "caught up" badge.
- 🔍 **Lost & Found Portal**: Categorized lost/found items with direct WhatsApp contact buttons and owner resolution tools.
- 📅 **Campus Events & RSVPs**: Interactive campus calendar, Google Maps/Calendar links, and live RSVP counters.
- 🏆 **Gamification & Leaderboard**: Student points system (+10 for posts/notices, +2 for comments/RSVPs) with dynamic top contributor badges.
- 🔔 **Real-Time Notification Tray**: Instant unread badge counter and batch mark-as-read system.
- 🛡️ **Admin Portal (`/admin-portal`)**: Protected moderation portal for reported content dismissal/deletion and official announcement broadcasting with feed shield badges.

---

## 🛠️ Prerequisites

- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **Firebase Project**: Cloud Firestore database, Firebase Auth (Phone + Google), and Firebase Storage enabled.

---

## 🚀 Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/college-times.git
   cd "Colleges Times"
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in your Firebase project credentials:
   ```bash
   cp .env.example .env
   ```

   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Start local development server**:
   ```bash
   npm run dev
   ```

5. **Build for production**:
   ```bash
   npm run build
   ```

---

## 🌐 Vercel Production Deployment Instructions

1. **Push Code to GitHub**:
   Push the project codebase to your GitHub repository.

2. **Create New Project on Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard) -> **Add New Project**.
   - Select your GitHub repository.
   - **Framework Preset**: Select **Vite**.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

3. **Set Environment Variables in Vercel**:
   Add all six `VITE_FIREBASE_*` variables from `.env` to Vercel's **Environment Variables** panel (apply to Production, Preview, and Development environments).

4. **Deploy**:
   Click **Deploy**. Vercel will build and assign a deployment URL (e.g. `https://college-times.vercel.app`).

5. **Configure Firebase Authorized Domains**:
   - Go to [Firebase Console](https://console.firebase.google.com/project/college-times-9f395/authentication/providers).
   - Go to **Authentication** -> **Settings** -> **Authorized Domains**.
   - Add your Vercel domain (`college-times.vercel.app`) to authorize Phone OTP reCAPTCHA and Google Sign-In popups.

---

## 🔒 Security & Security Rules

- **Database Rules**: [`firestore.rules`](file:///c:/Users/tanis/OneDrive/Desktop/Colleges%20Times/firestore.rules)
- **Storage Rules**: [`storage.rules`](file:///c:/Users/tanis/OneDrive/Desktop/Colleges%20Times/storage.rules)
- **Deployment Command**:
  ```bash
  npx firebase-tools deploy --only firestore:rules,storage --project college-times-9f395
  ```
