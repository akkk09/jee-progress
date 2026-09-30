# JEE Progress

A local-first JEE preparation dashboard built around the daily workflow: plan what to study, track lectures, complete the syllabus, record PYQs, and review study history.

## Features

- Configurable JEE countdown and exam name/date
- Simple local email/password login and logout
- Lecture queue with external YouTube/lecture links
- Watched minutes, optional duration, priority, planned date and completion
- Chapter detail pages connecting lectures, module completion and PYQs
- 54 JEE Main syllabus modules seeded from the official NTA 2026 syllabus
- Module completion tracking
- PYQ tracking for 2024, 2025 and 2026
- Optional PYQ total/correct counts and accuracy
- Daily study plan for the next week
- Persistent study sessions with subject/chapter
- 7-day study history and recent sessions
- Needs-attention view based on your own completion/PYQ data
- Full-syllabus mock test tracker with score trends and subject breakdowns
- Search/command palette with Ctrl/Cmd+K
- Dark/light theme
- JSON export/import backups
- Responsive mobile layout
- Browser localStorage persistence per authenticated user

## Run

```bash
npm install
npm run dev
```

## Storage and authentication

There is no backend, cloud sync, or database. Accounts and study data stay in the browser's localStorage and are separated by local account ID.

This authentication is a lightweight local privacy gate, not server-side security. A person with access to the browser's local data can bypass it. For real multi-device/private accounts, a backend authentication service would eventually be required.

## Data backup

Use **Settings → Export JSON** regularly. Use **Import JSON** to restore a backup on the same browser or another browser.

The exam date is configurable because the exact target-attempt date may change.
