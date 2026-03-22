# Documentation

Architecture and design documentation for **harshkakashaniya.github.io**.

All diagrams are written in [Mermaid](https://mermaid.js.org/) and render natively on GitHub.

---

## Diagrams

| File | Description |
|------|-------------|
| [diagrams/site-architecture.md](diagrams/site-architecture.md) | Technology stack, page routing, Jekyll template hierarchy, game session counter sequence |
| [diagrams/file-structure.md](diagrams/file-structure.md) | Full directory map and quick-reference table for every path |
| [diagrams/data-flow.md](diagrams/data-flow.md) | Home page animations, games interaction map, CSS layer order, deployment pipeline |

---

## Tech Stack at a Glance

| Concern | Solution |
|---------|---------|
| Static site generator | **Jekyll** (GitHub Pages built-in) |
| Hosting | **GitHub Pages** (`master` branch → auto-deploy) |
| Styling | **SCSS** → `css/main.css` + `css/modern.css` |
| Fonts | Proxima Nova (self-hosted in `fonts/`) |
| Game counters | **Firebase Realtime Database** (REST API, atomic increment) |
| Animations | Vanilla JS — `IntersectionObserver`, `Date.now()` count-up |
| Games | Pure HTML/CSS/JS — Blackjack, Snake & Ladder, 4 in a Row |

---

## Branch Strategy

```
master   ← production (auto-deploys to GitHub Pages)
revamped ← feature development
cleanup  ← repo housekeeping (this branch)
```
