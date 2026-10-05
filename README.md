# HAC Gradebook

A mobile-first progressive web app for reading a Home Access Center gradebook. The React app talks to a small Express service, which signs in to the district portal, holds the portal cookies in memory, and returns parsed classes as JSON.

Plainfield’s portal is prefilled:

`https://esp-has-1.psd202.org/HomeAccess/Account/LogOn?ReturnUrl=%2fhomeaccess%2f`

## What you can do

- Sign in with your HAC username and password. The district field accepts another HTTPS Home Access address if you need one.
- See each class as a card colored by letter: green A, blue B, yellow C, orange D, red F.
- Open a class for assignments grouped by category or by date, including category weights.
- Add a mock assignment or edit a weight. The weighted average and GPA update in the browser and are not sent back to HAC.
- Read an unweighted 4.0 GPA (A/A+ = 4.0, A- = 3.7, B+ = 3.3, and so on through F = 0).
- Install the app and reopen the last saved gradebook while offline.

Preview the interface without a portal account by choosing **Preview with sample grades**, or sign in with username `demo` and password `demo`.

## Run it locally

```bash
npm install
npm test
npm run dev
```

The API listens on `http://localhost:8787`. The app listens on `http://localhost:5173` and proxies `/api` to the API.

## Security

- The portal URL must be public HTTPS. Local and IP addresses are rejected.
- Passwords are used only for the sign-in request. They are not written to the server log or saved on the server.
- Portal cookies stay in the API process memory and expire after eight hours (set `SESSION_TTL_HOURS` to change that). The browser receives a random session token, not the portal cookie.
- **Remember me** encrypts the password with AES-GCM in this browser. The key is non-extractable and stored in IndexedDB. Uncheck the box, or log out after clearing site data, to remove it.
- The last gradebook JSON is cached in `localStorage` so the installed app can open offline. Log out clears that cache.

## Deploy

No API keys are required. Hook the GitHub repo up in each dashboard and set one environment variable on each side. You do not need to paste tokens into chat.

### API on Render

`render.yaml` is a Render blueprint for the `server` directory.

1. In Render, create a blueprint from this repo.
2. Set `CLIENT_ORIGIN` to the Vercel origin, for example `https://your-app.vercel.app`.
3. Deploy. The health check is `/api/health`.

### App on Vercel

1. Import the repo and set the project root to `frontend`.
2. Add `VITE_API_URL` as the Render origin, for example `https://hac-gradebook-api.onrender.com`. Do not add a trailing slash.
3. Deploy. Client-side routes fall back to `index.html`.

The service worker precaches the app shell, caches fonts and images, and uses a network-first cache for same-origin `/api/grades` responses. Grade JSON is also stored on the device for offline use when the API lives on another origin.

## How grades are read

Sign-in posts the same Home Access fields the portal form uses, including `__RequestVerificationToken`, `LogOnDetails.UserName`, `LogOnDetails.Password`, and the hidden `Database` value. After the session cookies are stored, the API requests `Content/Student/Assignments.aspx` and, if that page has no classes, `Classes/Classwork`.

Cheerio reads each `div.AssignmentClass`: the course and teacher, the cumulative average, category weights, and assignment rows (name, dates, score, points possible, category). Excused and ungraded rows stay in the list but do not change the what-if math. A missing score counts as zero when points possible are known.

Category percent is points earned divided by points possible. The course percent is the weighted average of those category percents.
