# JEE Progress

A JEE preparation tracker with Supabase authentication and local browser storage.

## Features

- Configurable JEE countdown
- Lecture tracker with YouTube/lecture links
- Manually recorded minutes watched per lecture
- Lecture completion checkboxes
- 54 JEE Main syllabus modules seeded from the official NTA 2026 syllabus
- Module completion tracking
- PYQ checkboxes for 2024, 2025 and 2026
- Study stopwatch
- Browser localStorage persistence per authenticated user
- Supabase email/password authentication

## Run

```bash
npm install
npm run dev
```

Authentication is handled by Supabase. Study data stays in the browser for now; there is no cloud sync or database for tracker data.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your deployment environment before running the app.

The exam date is configurable in the sidebar because the official date for the user's target attempt may change.
