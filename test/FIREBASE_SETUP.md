# Firebase Setup Guide — MotorTown Route Editor

Follow every step in order. Takes about 20–30 minutes.

---

## PART 1 — Create the Firebase Project

1. Go to https://console.firebase.google.com
2. Click **"Add project"**
3. Name it e.g. `motortown-routes` → Continue
4. **Disable Google Analytics** (not needed) → Create project
5. Wait for it to finish → click **Continue**

---

## PART 2 — Register Your Web App & Get Config

1. In the Firebase Console, click the **`</>`** (Web) icon on the project overview page
2. App nickname: `MotorTown Route Editor` → click **Register app**
3. You'll see a block of code containing `firebaseConfig`. **Copy the entire config object** — it looks like:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "motortown-routes.firebaseapp.com",
  projectId: "motortown-routes",
  storageBucket: "motortown-routes.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

4. Open `firebase-config.js` in your project and **replace the placeholder config** with your values
5. Click **Continue to console**

---

## PART 3 — Enable Google Sign-In

1. In the left sidebar: **Build → Authentication**
2. Click **Get started**
3. Under **Sign-in providers**, click **Google**
4. Toggle **Enable** → ON
5. Set a **Project support email** (your email)
6. Click **Save**

### Add Authorized Domains

Still in Authentication → **Settings tab** → **Authorized domains**:

Click **Add domain** and add ALL of these:

- `localhost` ← for testing locally
- `yourusername.github.io` ← replace with YOUR GitHub username
- `yourusername.github.io/your-repo-name` ← if your site is in a subdirectory

> **Important:** The domain must exactly match what appears in your browser's address bar when visiting the site.

---

## PART 4 — Create Firestore Database

1. In the left sidebar: **Build → Firestore Database**
2. Click **Create database**
3. Choose **"Start in production mode"** (we'll deploy rules in a moment)
4. Select a region — choose the one closest to your players (e.g. `europe-west2` for UK)
5. Click **Done** and wait for it to provision

---

## PART 5 — Deploy Firestore Security Rules

### Option A: Via Firebase Console (easiest)

1. In Firestore → click the **Rules tab**
2. Delete the existing placeholder rules
3. Copy the **entire contents of `firestore.rules`** from your project
4. Paste it into the editor
5. Click **Publish**

### Option B: Via Firebase CLI (recommended for ongoing use)

```bash
# Install Firebase CLI (one time)
npm install -g firebase-tools

# Login
firebase login

# In your project folder, initialize
firebase init firestore

# When asked which project, select motortown-routes
# When asked about rules file, type: firestore.rules
# When asked about indexes, press Enter to accept default

# Deploy rules
firebase deploy --only firestore:rules
```

---

## PART 6 — Set Up a Composite Index (Required for Queries)

Firestore requires composite indexes for queries that filter AND sort on multiple fields.

1. In Firestore → **Indexes tab**
2. Click **Add index**
3. Collection: `routes`
4. Add fields in this order:
   - `isPublic` → Ascending
   - `updatedAt` → Descending
5. Click **Create**

> Repeat for this index too:
> - `isPublic` → Ascending
> - `ownerUid` → Ascending
> - `updatedAt` → Descending

Indexes take 1–5 minutes to build. You'll see a spinner in the console.

**Shortcut:** When you first run the app and open the community page, Firestore will log an error in the browser console with a direct link to create the missing index — click it.

---

## PART 7 — Add the Config to Your Project

1. Open `firebase-config.js`
2. Replace every `REPLACE_WITH_YOUR_*` value with the values from Step 2
3. Save the file

---

## PART 8 — Add Files to GitHub

Add all these new files to your repository:

```
firebase-config.js       ← your config (see security note below)
auth-ui.js
firestore-routes.js
community.js
community.html
community.css
firestore.rules
```

Update these existing files:
```
index.html               ← replace with the new version
main-overrides.js        ← replace with the new version
style.css                ← append contents of auth-additions.css to the bottom
```

Push to GitHub. GitHub Pages will deploy automatically.

### ⚠️ API Key Security Note

Your Firebase `apiKey` in `firebase-config.js` **will be publicly visible** in your GitHub repo and in the browser. **This is normal and expected for Firebase web apps.** The API key alone does not grant access to your data — security is enforced entirely by the Firestore security rules you deployed in Part 5.

To reduce abuse, you can restrict the API key in Google Cloud Console:
1. Go to https://console.cloud.google.com → APIs & Services → Credentials
2. Click your API key
3. Under **Application restrictions** → choose **HTTP referrers**
4. Add: `https://yourusername.github.io/*`

---

## PART 9 — Set an Admin Account

The first time you sign in, you'll be assigned `role: "user"` automatically. To grant yourself admin:

1. In Firebase Console → Firestore → **Data tab**
2. Navigate to `users` collection → click on your user document (the ID is your Google UID)
3. Find the `role` field → click the pencil icon → change `"user"` to `"admin"`
4. Click Update

Refresh the site and sign in — you'll see a ⭐ next to your name and the Admin Tools panel in the community browser.

> Only do this for yourself (or trusted GMs). Never expose an "promote to admin" button in the UI.

---

## PART 10 — Test Everything

Work through this checklist:

- [ ] Open `index.html` → sign in with Google → profile modal appears
- [ ] Fill in in-game name and Discord → save → modal closes, name appears in topbar
- [ ] Paste a route JSON → Process → Save Changes → toast says "Saved to cloud ☁"
- [ ] Open `community.html` → your route appears in the table
- [ ] Click a row → detail panel opens → "Load in Editor" returns you to index.html with the route loaded
- [ ] Toggle "Make Hidden" on a route → it disappears from public listing
- [ ] Sign out → try to access routes → public ones still visible, hidden ones not
- [ ] Open browser console → no errors (except possibly missing index links — follow them to create)

---

## Troubleshooting

**"auth/unauthorized-domain" error**
→ You missed adding your domain in Part 3. Double-check the exact URL in your address bar matches what you added.

**"Missing or insufficient permissions" error**
→ Your Firestore rules aren't deployed yet, or there's a typo. Re-copy from `firestore.rules` and republish.

**"The query requires an index" error in console**
→ Click the link in the error message — it takes you directly to create the needed index.

**Google Sign-In popup closes immediately**
→ Check that your browser isn't blocking popups for the site.

**Routes save locally but not to cloud**
→ Check the browser console for the specific Firestore error. Usually a rules or index issue.

**Community page shows no routes**
→ Make sure at least one route has `isPublic: true` in Firestore. Check the Data tab.
