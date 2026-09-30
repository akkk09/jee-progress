# JEE Progress

A JEE preparation tracker with simple local authentication and browser storage.

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
- Simple local email/password login and logout

## Run

```bash
npm install
npm run dev
```

Authentication and study data stay in the browser for now; there is no backend, cloud sync, or database. This is a lightweight privacy gate, not server-side security.

The exam date is configurable in the sidebar because the official date for the user's target attempt may change.
