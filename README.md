# ukorganist.com

Website for UK Organist — Jay Berry, wedding and funeral organist in Lancashire and Greater Manchester.
Static site served by a Cloudflare Worker (static assets). Cloudflare runs `node build.mjs`
then deploys `dist/` on every push to `main`. No packages to install.

| Folder / file | What's in it |
| --- | --- |
| `src/pages/` | Page bodies with front matter (title, description, nav, crumb, service, noindex). URLs end in `/`. |
| `src/pages/areas/` | Local landing pages (Burnley, Blackburn, Bolton, Rochdale) at `/areas/<town>/` |
| `src/partials/` | Header and footer. `src/layout.html` is the page shell. |
| `public/` | Copied as-is: CSS/JS, logo, favicons, social image, `_headers`, `_redirects`, `robots.txt` |
| `public/_redirects` | Old WordPress URLs, permanently redirected to their new pages |

Phone, WhatsApp and email live in `LINKS` in `build.mjs` and are used in pages as `{{phone}}`,
`{{whatsapp}}`, `{{email}}` and so on. Change them there once and every page updates.

The enquiry form (`src/partials/enquiry-form.html`, placed in a page with `<!--@ENQUIRY_FORM-->`)
posts each enquiry to a Google Apps Script web app in the jb@ukorganist.com account
(`google-apps-script/Code.gs`, project "UKO Website Enquiries"). The script adds a row to the
"UKO Enquiries" Google Sheet and emails Jay. Its /exec URL is `ENQUIRY_ENDPOINT` in
`public/assets/site.js`. "Send on WhatsApp" also opens a pre-filled WhatsApp message; if the
script can't be reached, "Send enquiry" falls back to the visitor's email app.
Links like `/contact/?service=funeral#enquiry` pre-select the type of service.

## What the build does

- Wraps each page in the layout, with title, meta description, canonical URL and social tags
- Adds LocalBusiness + Person + WebSite schema to every page, breadcrumbs on inner pages,
  Service schema where a page sets `service:`, and FAQPage schema built automatically from
  any `<details class="faq">` questions on the page
- Writes `sitemap.xml`
- Fails if: an internal link or #anchor is broken, a link is missing its trailing slash,
  a page doesn't have exactly one `<h1>`, a title is over 65 characters, a description isn't
  70–165 characters, or the old wrong WhatsApp number / Lorem ipsum appears anywhere

## Adding a new area page

Copy `src/pages/areas/bolton.html` to `src/pages/areas/<town>.html`, rewrite the copy so it's
genuinely about that town (don't just swap the name — Google ignores copy-paste town pages),
then link to it from `src/pages/areas.html` and the footer.
