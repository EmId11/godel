# Godel Analytics

Landing page for **Godel Analytics** — Organisational Network Analysis (ONA) consulting.

> The org chart shows reporting lines. We map how information, influence and trust actually move.

The hero is a live, interactive force-directed network: nodes are sized and coloured by
degree centrality (cool periphery → glowing gold connectors), with light packets pulsing
along edges to represent information flow. Drag your cursor through it to part the network
and light up the nearest connector.

## Stack

Plain HTML, CSS and vanilla JS — no build step, no dependencies. Deploys anywhere static.

```
index.html        markup + content
css/styles.css    styling, layout, animations
js/network.js     the canvas network simulation (hero)
js/main.js        nav + reveal-on-scroll
favicon.svg       node-graph mark
CNAME             custom domain for GitHub Pages (godel.com.au)
```

## Run locally

It's static, so just open `index.html` — or serve it (recommended, so fonts/paths behave):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy

**GitHub Pages** (the `CNAME` file is already set to `godel.com.au`):

1. Push this repo to `EmId11/godel`.
2. Repo → Settings → Pages → Source: deploy from `main` / root.
3. In GoDaddy DNS, point the domain at GitHub Pages:
   - `A` records for the apex `godel.com.au` → `185.199.108.153`, `.109.153`, `.110.153`, `.111.153`
   - `CNAME` for `www` → `emid11.github.io`
4. Settings → Pages → enable **Enforce HTTPS** once the cert is issued.

Any static host works too (Netlify, Cloudflare Pages, Vercel) — point it at this directory.

## Customise

- **Contact email** — `ayman@godel.com.au` (in `index.html`, two spots + footer).
- **Copy / sections** — all in `index.html`.
- **Colours / fonts** — CSS variables at the top of `css/styles.css` (`--gold`, `--blue`, font stacks).

## Design notes

- Display: **Fraunces** · Body: **Hanken Grotesk** · Data labels: **JetBrains Mono** (Google Fonts).
- Respects `prefers-reduced-motion` (pauses pulses and entrance animations).
- The hero simulation pauses when scrolled out of view to save battery.
