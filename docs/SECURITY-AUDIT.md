# aureon landing — security audit & hardening record

Date: 2026-11-06 · Scope: `aureon.asherin.com` (Vercel project `aureon-landing`, repo `shep95/aureon-asherin`)
Method: source review of every served file, media metadata inspection, header design, and automated browser
tests (Playwright + Chromium) run against the production header set. This file is excluded from deployment
(`.vercelignore`), so it never becomes a public URL.

Evidence labels (per the House of Asher planning framework): **verified** = tested in this session;
**configured** = set in code, takes effect on deploy; **owner action** = needs a dashboard change; **limit** = cannot
be fully solved on the web, stated plainly.

---

## 1. What the site is (attack surface)

A static page: one HTML file, one stylesheet, one script, images and a looping video. There is **no backend, no
database, no API, no cookies, and no third-party code**. The sign-up / log-in form is a front end only: it sends
nothing anywhere. So the realistic threats are: content theft (scraping, hotlinking), embedding the page
somewhere hostile (clickjacking), script injection if the page ever grows dynamic content, information leaks
through files and metadata, and future risk once real authentication is connected.

## 2. Findings and fixes

| # | Finding | Severity | Fix | Status |
|---|---------|----------|-----|--------|
| F1 | No security headers at all (no CSP, HSTS, frame protection, nosniff) | High | Full header set in `vercel.json` (see §3) | configured · CSP/TT verified locally |
| F2 | Page could be framed by any site → clickjacking of the sign-in dialog | High | `frame-ancestors 'none'` + `X-Frame-Options: DENY` | configured |
| F3 | Inline `<style>` and `<script>` forced any CSP to allow `'unsafe-inline'` | Medium | Moved to `/app.css` and `/app.js`; CSP is `'self'` only | verified (injected script blocked) |
| F4 | `innerHTML` used to set button text (XSS sink if copy ever became dynamic) | Medium | Replaced with `textContent`; **Trusted Types enforced** so no HTML sink can be used at all | verified |
| F5 | Video metadata revealed provenance (`Twitter-vork muxer`) and x264 encoder settings were embedded in the bitstream | Medium | Re-encoded; container tags stripped; x264 SEI user-data NAL units removed | verified (`strings` scan clean) |
| F6 | Poster JPEG carried an encoder comment | Low | Rebuilt from raw pixels; webp poster has no metadata chunks | verified |
| F7 | Video carried an unused audio track | Low (waste) | Audio removed | verified |
| F8 | `README.md` deployed publicly, describing that auth is not connected | Low | `.vercelignore` excludes README, `docs/`, `*.md`, env/log/backup files | configured |
| F9 | Media could be hotlinked / embedded by other sites | Medium | `Cross-Origin-Resource-Policy: same-origin`; cross-site asset requests and direct opening of asset URLs redirect to `/` | configured |
| F10 | AI-training and bulk crawlers not addressed | Medium | `robots.txt` refuses ~35 named AI/scraper crawlers; `noai, noimageai` meta + headers; assets `noindex, noimageindex` | configured |
| F11 | Form could post credentials if a future edit added an `action` | Low (latent) | CSP `form-action 'none'`; submit handler clears the password field and sends nothing | verified (0 non-GET requests) |
| F12 | Password field lacked validation feedback; values persisted after close | Low | Validation with `aria-invalid`; form reset + password re-masked on close | verified |
| F13 | Browser features not restricted | Low | `Permissions-Policy` denies camera, mic, geolocation, USB, payment, topics, etc. | configured |
| F14 | No cross-origin isolation | Low | `COOP: same-origin`, `COEP: require-corp`, `Origin-Agent-Cluster` | configured |
| F15 | Vercel managed firewall not enabled | Medium | API refused this connector (team-scope 404). Steps in §5 | **owner action** |

## 3. Header set (served on every response)

`Content-Security-Policy`: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; media-src 'self';
font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'none'; frame-src 'none'; child-src 'none';
object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests;
require-trusted-types-for 'script'; trusted-types 'none'`

Plus: HSTS (2 years, subdomains), `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
Permissions-Policy, COOP/COEP/CORP, `X-Permitted-Cross-Domain-Policies: none`, DNS-prefetch off,
`X-Robots-Tag` (page: `noai, noimageai`; assets: `noindex, noimageindex, noarchive, nosnippet, noai, noimageai`).

**When you add anything external** (analytics, fonts, an auth provider), the CSP must list that exact origin or
it will be blocked. That is the policy working, not a bug.

## 4. Anti-scraping: what is and is not possible (limit)

Anything a browser can display, a determined person can copy: they can screenshot, screen-record, or read the
network panel. No website can make that impossible. What this build does is make copying **costly, unattractive
and non-automatic**:

- polite crawlers (search engines, most AI companies) are told no via `robots.txt` and headers;
- the Vercel firewall (once enabled, §5) actively blocks known AI bots and challenges non-browser clients;
- other websites cannot embed or hotlink the media (CORP + redirects);
- opening a media URL directly in a tab bounces to the homepage;
- media has no metadata to harvest, no download / picture-in-picture / cast controls, and no right-click or
  drag-to-save on images and video (text stays selectable for accessibility);
- there is no API, database or JSON to scrape at all.

Deliberately **not** done: hiding text behind JavaScript or images. It barely slows scrapers, breaks screen readers
and search engines, and would contradict the accessibility guidance in the design datasets.

The page itself remains indexable by search engines so people can find aureon. To remove it from search
entirely, change the page `X-Robots-Tag` and meta robots to `noindex, nofollow` (one-line change).

## 5. Owner actions (Vercel dashboard → aureon-landing → Firewall)

1. **Bot Management → AI Bots: Deny.**
2. **Bot Management → Bot Protection: Challenge** (verified search engines and link previews still pass).
3. Optional: a rate-limit rule on `/assets/` (e.g. 60 requests / 60 s per IP) to stop bulk downloading.
4. Optional: add `/.well-known/security.txt` with a contact address so researchers can report issues.

## 6. Branches: future patterns, derived from past ones

Each branch: *pattern seen → what it predicts → prevention already in place → trigger to act*.

**B1. Authentication goes live** (the form exists, so this is the next step)
- Predicts: credential stuffing, password spraying, account enumeration, phishing look-alikes.
- In place: no credentials ever leave the page today; `form-action 'none'`.
- When connecting a provider: use a managed auth service (no home-made password storage); add its origin to
  `connect-src`/`form-action` only; rate-limit login and reset; identical responses for "unknown email" and "wrong
  password"; breached-password check; MFA / passkeys (Permissions-Policy already allows WebAuthn for self);
  `HttpOnly; Secure; SameSite=Strict` session cookies; CSRF protection.

**B2. Content becomes dynamic** (CMS, user text, database)
- Predicts: stored XSS, injection.
- In place: Trusted Types + strict CSP mean injected HTML/script fails in the browser even if a server bug lets it
  through. Keep using `textContent`; never re-enable `'unsafe-inline'`.

**B3. Third-party scripts get added** (analytics, chat, tag managers)
- Predicts: supply-chain compromise, data leakage, a looser CSP.
- Prevention: self-host where possible; pin versions; use Subresource Integrity; add origins one at a time; review
  every new `connect-src` host.

**B4. Media scraping escalates** (after launch / press)
- Predicts: bulk downloaders spoofing browser headers, rotating IPs.
- Prevention: firewall bot protection + rate limits (§5); watermark future hero media; keep high-resolution masters
  off the public site.

**B5. Domain / DNS** (`asherin.com` has many subdomains across projects)
- Predicts: subdomain takeover when a project is deleted but its DNS record remains.
- Prevention: remove DNS records when retiring projects; enable registrar lock and DNSSEC; consider HSTS preload
  on the apex once every subdomain is HTTPS.

**B6. Brand impersonation**
- Predicts: look-alike domains hosting fake aureon sign-in pages.
- Prevention: `frame-ancestors 'none'` stops framing; monitor look-alike registrations; publish the one true
  sign-in URL.

**B7. Repository hygiene**
- Predicts: secrets committed by accident once a backend exists.
- Prevention: keep secrets in Vercel environment variables only; `.vercelignore` already blocks `.env*`; enable
  GitHub secret scanning and push protection.

## 7. Verification log (this session)

21/21 automated browser checks passed against the production header set, including: CSP blocks injected script;
Trusted Types blocks HTML injection; form submission makes zero network requests; context menu blocked on media
but not on text; reduced-motion respected; Save-Data never downloads the video; dialog focus returns correctly.
Media files scanned with `ffprobe` and `strings`: no provenance or encoder strings remain.
Not verifiable from this environment: live response headers on `aureon.asherin.com` (network blocked). Check them
after deploy at securityheaders.com or with `curl -I https://aureon.asherin.com`.
