# ResQBot

A cinematic site for **ResQBot** — a smartphone-controlled, 2WD ESP32 rover
exploring remote emergency-response robotics through fire-response payload
collection and launching. The current prototype uses a lightweight foam
ball as its payload; it does **not** detect or extinguish real fires, carries
no certified fire-suppression capability, and does not use CO₂ or any other
extinguishing agent.

Built with React 19, TypeScript, Vite, Tailwind CSS v4, and Framer Motion.

## Getting started

```bash
npm install
npm run dev
```

The dev server prints a local URL (typically `http://localhost:5173`).

Other scripts:

```bash
npm run build    # type-check and produce a production build in dist/
npm run preview  # serve the production build locally
npm run lint     # run oxlint
```

## Environment variables

Copy `.env.example` to `.env.local` and adjust as needed:

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_ROBOT_MOCK_MODE` | Forces the Control Console's mock ESP32 service. Every `VITE_`-prefixed variable is bundled into client JS, so nothing secret can live here. | `true` |
| `VITE_ROBOT_API_BASE_URL` | Base URL of a future secure gateway that relays commands to the rover. Empty means mock mode regardless of the flag above. | *(empty)* |

There are currently no real external APIs and no server-side secrets. The
"Control Console" section on the site (`src/services/robotService.ts`) is a
**simulated** command interface for demonstration purposes only — it never
contacts real hardware. If a live ESP32 gateway is built later, keep any
credentials it needs in Netlify Function environment variables, never in a
`VITE_`-prefixed variable.

## Contact form

The contact form uses **Netlify Forms** (no backend server or function
required). It's wired up in two places that must stay in sync:

- `index.html` has a hidden static `<form name="contact" data-netlify="true">`
  so Netlify's build-time bot can detect the form's fields.
- `src/sections/Contact.tsx` renders the real, interactive form and submits
  it via `fetch` to `/`.

**This only works once the site is deployed on Netlify** (or run through
`netlify dev`) — a plain `npm run dev` / `vite preview` server has nothing to
receive the POST, so submissions will fail locally. To view submissions after
deploying: Netlify dashboard → your site → **Forms**.

Basic spam protection is a honeypot field (`bot-field`); no CAPTCHA is
configured. Add one manually (e.g. Netlify's reCAPTCHA integration) if spam
becomes a problem.

## Deploying to Netlify

Build settings (already codified in `netlify.toml`):

- **Build command:** `npm run build`
- **Publish directory:** `dist`

Steps:

1. Push this repository to GitHub.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Netlify reads `netlify.toml` automatically — confirm build command/publish
   directory match the values above and deploy.
4. If you set any environment variables (see table above), add them under
   **Site configuration → Environment variables** in the Netlify dashboard,
   not in a committed file.
5. After the first deploy, enable **Forms** detection if it isn't automatic
   (Netlify usually detects the static form in `index.html` on the first
   build) so the contact form has somewhere to send submissions.

To update the live site, push to the branch Netlify is watching — it
rebuilds and redeploys automatically. Build logs are under **Deploys** on the
site's Netlify dashboard.

## Project structure

```
src/
  components/    Reusable UI: preloader, nav, robot visual, buttons, etc.
  sections/      One file per page section (Hero, Mechanism, Contact, ...)
  services/      robotService.ts — mock-first ESP32 command interface
  data/          Static content (nav items, mechanism labels, mission steps)
  hooks/         Reduced-motion, active-section, intro-seen helpers
```

## Known limitations

- The "Control Console" is a UI demonstration only; there is no physical
  rover connected to this website.
- The contact form requires a Netlify (or Netlify-compatible) hosting
  environment to actually deliver submissions.
- GitHub and documentation links in the footer are placeholders pending a
  public repository.
