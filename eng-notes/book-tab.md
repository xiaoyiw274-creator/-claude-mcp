# Book Tab (replaces Code tab) — 2026-07-01

## What changed
- Sidebar: "Code" → "Book" with book icon (SVG)
- Code list view replaced with Book view containing:
  1. **Clawd** animated GIF mascot (idle/happy/thinking/sleeping/annoyed/jump states)
  2. **共读书架** — bookshelf showing all uploaded ebooks with progress
  3. **目录** — chapter table of contents with read/current indicators
  4. **阅读器** — chapter reader with sentence-level selection + danmaku
  5. **召唤宝** — @宝 in danmaku or summon button to get commentary
- Terminal detail mode preserved (accessible from Chats view switch)
- All ebook API calls go through `/api/ebooks*` (Caddy -> port 5180)

## Files modified
- `/root/prism/static/app.html` — HTML structure + BookView JS object
- `/root/prism/static/companion.css` — Book view styles (warm palette + dark mode)

## Architecture
- BookView object manages shelf/toc/chapter views within the code-list container
- Header dynamically updates title + back/summon buttons per view state
- Clawd GIF state machine: setClawdState() / flashClawd(state, ms) for timed reactions
- exitDetail() override returns to book shelf
- switchView('code') override reloads shelf when in list mode
