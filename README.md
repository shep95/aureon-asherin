# aureon landing page

Static site for https://aureon.asherin.com, deployed by Vercel on every push to this branch.
No build step, no dependencies.

## files

| path | purpose |
|------|---------|
| `index.html` | markup only (no inline CSS/JS, required by the CSP) |
| `app.css` | the whole design system: tokens, components, responsive rules, motion |
| `app.js` | video handling, scroll reveal, auth dialog (no `innerHTML`, Trusted Types safe) |
| `assets/` | media, versioned (`-v2`) and cached for a year; **rename the file when you change it** |
| `vercel.json` | security headers, caching, media hotlink protection |
| `robots.txt` | crawler policy (AI/scraper bots refused, assets not crawlable) |
| `.vercelignore` | keeps README, `docs/` and private files off the public site |
| `docs/SECURITY-AUDIT.md` | security findings, fixes, owner actions and future-risk branches |

## run locally

`python3 -m http.server 8000`, then open http://localhost:8000.

## rules for future edits

- Don't add inline `<style>`, `style="…"`, `<script>` or `onclick=`; the CSP will block them. Put code in `app.css` / `app.js`.
- Don't use `innerHTML`; Trusted Types will throw. Use `textContent` / `createElement`.
- Adding any external service means adding its exact origin to the CSP in `vercel.json`.
- Don't put `backdrop-filter` on large panels over the video; it re-blurs every frame and causes lag.
- Strip metadata from new media before committing (see the audit doc for the commands used).

## authentication

The sign-up/log-in form is a front end only. Nothing is sent anywhere. Connect a managed auth provider before
enabling it (see branch B1 in the audit doc).
