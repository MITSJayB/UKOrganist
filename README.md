# jamesrobert.co.uk

Website for James Robert Berry – Organist: wedding and funeral organist in Lancashire and
Greater Manchester (sole trader; formerly traded as UK Organist Limited at ukorganist.com).
Static site served by a Cloudflare Worker (static assets). Cloudflare runs `node build.mjs`
then deploys `dist/` on every push to `main`. No packages to install.

| Folder / file | What's in it |
| --- | --- |
| `src/pages/` | Page bodies with front matter (title, description, nav, crumb, service, noindex). URLs end in `/`. |
| `src/pages/areas/` | Local landing pages (Burnley, Blackburn, Bolton, Rochdale) at `/areas/<town>/` |
| `src/partials/` | Header and footer. `src/layout.html` is the page shell. |
| `public/` | Copied as-is: CSS/JS, logo, favicons, social image, `_headers`, `_redirects`, `robots.txt` |
| `public/_redirects` | Old WordPress URLs, permanently redirected to their new pages |
| `worker/index.js` | Redirects every other domain (jamesrobert.uk, organistjames.co.uk/.uk, ukorganist.com/.co.uk, www.) to jamesrobert.co.uk, same path |

Phone, WhatsApp and email live in `LINKS` in `build.mjs` and are used in pages as `{{phone}}`,
`{{whatsapp}}`, `{{email}}` and so on. Change them there once and every page updates.

The enquiry form (`src/partials/enquiry-form.html`, placed in a page with `<!--@ENQUIRY_FORM-->`)
posts each enquiry to a Google Apps Script web app in the music@jamesrobert.co.uk account (formerly jb@ukorganist.com)
(`google-apps-script/Code.gs`, project "UKO Website Enquiries"). The script adds a row to the
"UKO Enquiries" Google Sheet and emails James. Its /exec URL is `ENQUIRY_ENDPOINT` in
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

## Domains

jamesrobert.co.uk is the only address the site answers on. Add jamesrobert.uk, organistjames.co.uk,
organistjames.uk, ukorganist.com and ukorganist.co.uk (and their www. versions) as custom domains
on the same Worker in Cloudflare;
`worker/index.js` sends them all to the matching page on jamesrobert.co.uk with a 301.
Keep ukorganist.com and ukorganist.co.uk renewed for a few years so old links and search history carry across.

The build fails if the old trading name, "Limited", the company number or "Jay Berry" appear
anywhere on the public site.
