# Data Flow & Feature Interactions

## Home Page — Scroll Animations & Dynamic Content

```mermaid
flowchart TD
    Load["Page Load"] --> Static["Render static HTML\n+ CSS styles"]
    Load --> IO["IntersectionObserver\nwatches .yt-card"]

    Static --> Hero["Hero section\n(name, tagline, CTA buttons)"]
    Static --> About["About Me\n(3 paragraphs)"]
    Static --> YT["YouTube card\n(Soft Illusion)"]
    Static --> TL["Work Timeline\n(ArcBest → UMD → ACG)"]
    Static --> SK["Skills section"]

    IO -->|".yt-card enters viewport"| CountUp["Count-up animation\nViews: 0 → 755K+\nSubscribers: 0 → 4.5K+"]
    CountUp -->|"Date.now() + setTimeout loop\n1800ms cubic ease-out"| YT

    TL -->|"scroll-triggered fade-in"| ANIM["animation.js\nfade-up class toggle"]
```

---

## Games — Full Interaction Map

```mermaid
flowchart LR
    GamesPage["/Games/ page load"]

    GamesPage -->|"fetch /games.json"| FB[(Firebase\nRealtime DB)]
    FB -->|"{ blackjack:N, snakeladder:N, 4inarow:N }"| GamesPage
    GamesPage -->|"animate each badge"| Badges["👥 N sessions\n(count-up animation)"]

    BJ[Blackjack card click] --> BJPage["/Games/blackjack.html"]
    SL[Snake & Ladder card click] --> SLPage["/Games/snakeladder.html"]
    FR[4 in a Row card click] --> FRPage["/Games/4inarow.html"]

    BJPage -->|"sessionStorage check"| BJFB[(Firebase\ngames/blackjack)]
    SLPage -->|"sessionStorage check"| SLFB[(Firebase\ngames/snakeladder)]
    FRPage -->|"sessionStorage check"| FRFB[(Firebase\ngames/4inarow)]

    BJFB -->|"atomic increment"| BJFB
    SLFB -->|"atomic increment"| SLFB
    FRFB -->|"atomic increment"| FRFB
```

---

## CSS Architecture — Style Layering

```mermaid
flowchart TB
    subgraph Layer1["Layer 1 — Reset & Base"]
        BS["bootstrap.min.css\n(grid, utilities, components)"]
        MAIN["main.css\n(legacy template overrides)"]
    end

    subgraph Layer2["Layer 2 — Custom Modern UI"]
        MOD["modern.css\n(all new feature styles)"]
    end

    subgraph Sections["modern.css sections"]
        direction LR
        NAV["Navbar\n(dark, sticky, gold accent)"]
        HERO["Hero\n(full-height, animated)"]
        ABOUT["About\n(two-column layout)"]
        YTCARD["YouTube Card\n(.yt-card, .yt-logo, hover bg)"]
        TIMELINE["Work Timeline\n(.tl-*, .re-*)"]
        PROJ2["Projects Grid\n(.proj-card, .proj-tag)"]
        CERT2["Certifications\n(.cert-grid)"]
        GAMES2["Games Grid\n(.game-card, .game-sessions)"]
    end

    BS --> MOD
    MAIN --> MOD
    MOD --> NAV & HERO & ABOUT & YTCARD & TIMELINE & PROJ2 & CERT2 & GAMES2
```

---

## Deployment Pipeline

```mermaid
flowchart LR
    DEV["Local Development\n(edit files)"] -->|"git push origin master"| GH["GitHub\nmaster branch"]
    GH -->|"GitHub Actions / Pages CI\nautomatically triggered"| BUILD["Jekyll Build\n(~1–3 min)"]
    BUILD -->|"on success"| CDN["GitHub Pages CDN\nharshkakashaniya.github.io"]
    CDN -->|"served globally"| USERS["Visitors"]

    subgraph Branches
        MASTER["master\n(production)"]
        REVAMPED["revamped\n(development)"]
        CLEANUP["cleanup\n(this branch)"]
    end

    CLEANUP -->|"PR → merge"| MASTER
    REVAMPED -->|"merged into master\nwhen ready"| MASTER
```
