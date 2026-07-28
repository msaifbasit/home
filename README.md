# 🚀 3D Portfolio — Muhammad Saif Basit

An interactive, single-page 3D portfolio built with vanilla HTML/CSS/JS and
a hand-written WebGL background (zero dependencies). No build step, no
framework — edit one file and push to update the live site.

**Live site:** https://msaifbasit.github.io/home/

## ✏️ How to customize (the only file you need)

Everything on the site — name, roles, bio, skills, projects, links, colours —
lives in [`config.js`](config.js). Edit it, commit, push to `main`, and
GitHub Actions redeploys automatically in ~1 minute.

Common edits:

| I want to… | Do this in `config.js` |
|---|---|
| Change my resume | Nothing! The Resume button opens your Google Doc link — edit the doc and the site always shows the latest version. To point at a different file, change `resumeUrl`. |
| Add / remove a project | Add or delete an object in `projects.items`. Icons: `chat`, `vision`, `leaf`, `eye`, `film`, `cube`, `code`. |
| Update skills | Edit `skills.hard` (animated bars), `skills.stack` (tech chips) or `skills.soft`. |
| Change the typing roles | Edit `identity.roles`. |
| Change colours | Edit `theme.accent` and `theme.accent2`. |
| Swap my photo | Replace `assets/profile.png` (keep the same filename). |
| Tone down / disable the 3D scene | Lower `scene.particleCount`, or set `scene.enabled: false`. |

## 🗂 Project structure

```
├── index.html            # page skeleton (sections only, no content)
├── config.js             # ✏️ ALL content lives here
├── css/style.css         # theme, layout, animations
├── js/main.js            # renders config.js into the page + interactions
├── js/bg-scene.js        # dependency-free WebGL particle background
├── js/scene-worker.js    # runs the background in a Web Worker
├── assets/               # profile photo, favicon
└── .github/workflows/    # auto-deploy to GitHub Pages
```

## 🖥 Run locally

Any static server works:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

(Modules won't load from `file://` — you need a server.)

## 🌐 Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which publishes
the repo to **GitHub Pages** at `https://msaifbasit.github.io/portfolio/`.

If the first run fails, enable Pages once by hand: repo **Settings → Pages →
Source: GitHub Actions**, then re-run the workflow.

### Want a nicer / custom domain later?

- **Free subdomain:** import this repo at [vercel.com](https://vercel.com) or
  [netlify.com](https://netlify.com) → you get e.g. `saifbasit.vercel.app`
  with zero config (it's a static site).
- **Own domain (e.g. saifbasit.com):** buy the domain, then add it under
  repo **Settings → Pages → Custom domain** (GitHub hosts it for free; only
  the domain itself costs money).

## 🧰 Tech

- Hand-written WebGL (~10KB, zero dependencies) — particle network +
  wireframe icosahedron, mouse parallax, scroll dolly; rendered in a
  Web Worker on an OffscreenCanvas where supported
- Vanilla JS — typing effect, scroll-spy navbar, reveal-on-scroll,
  3D tilt cards
- Respects `prefers-reduced-motion`, responsive down to small phones
