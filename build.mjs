// Builds the static site into dist/. No dependencies: `node build.mjs`.
//
//   public/            copied as-is (assets, robots.txt, _headers, _redirects)
//   src/layout.html    the page shell: <head>, header, footer
//   src/partials/      header.html and footer.html
//   src/pages/         page bodies with a small front-matter block. URLs end in a slash:
//                      index.html -> /, weddings.html -> /weddings/,
//                      areas/burnley.html -> /areas/burnley/
//
// Page front matter (between --- lines at the top of each page):
//   title:       full <title> text (aim for under 60 characters)
//   description: meta description (aim for 120-160 characters)
//   nav:         which menu item to highlight (home, weddings, funerals, services, areas, about, contact)
//   crumb:       short name for the breadcrumb trail (defaults to the title)
//   service:     optional; adds Service schema with this name (e.g. "Wedding organist")
//   noindex:     true to keep a page out of search engines and the sitemap
//
// Questions written as <details class="faq"><summary>Question</summary><div>Answer</div></details>
// are added to the page's FAQPage schema automatically.
//
// The build fails on broken internal links, missing #anchors, unfilled placeholders,
// links without a trailing slash, missing/oversized titles and descriptions,
// and public text that breaks the site rules (wrong WhatsApp number, Lorem ipsum, "TBC").
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SITE = "https://ukorganist.com";
const BRAND = "UK Organist";
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, "dist");
const p = (...parts) => path.join(ROOT, ...parts);

// Shared details, available in pages and partials as {{name}}.
const LINKS = {
  phone: "07359 670332",
  tel: "tel:+447359670332",
  whatsapp: "https://wa.me/447359670332",
  email: "jb@ukorganist.com",
  mailto: "mailto:jb@ukorganist.com",
  companyNo: "16955057",
};

// Where Jay travels to. Used in the LocalBusiness schema.
const AREAS = [
  "Burnley", "Padiham", "Nelson", "Colne", "Pendle", "Accrington", "Rossendale", "Clitheroe",
  "Blackburn", "Darwen", "Bolton", "Bury", "Radcliffe", "Kearsley", "Rochdale", "Heywood",
  "Todmorden", "Lancashire", "Greater Manchester",
];

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const strip = (html) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&rsquo;|&lsquo;/g, "’").replace(/\s+/g, " ").trim();

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function listFiles(dir, ext, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return listFiles(f, ext, base);
    return f.endsWith(ext) ? [path.relative(base, f)] : [];
  });
}

// "---\nkey: value\n---\nbody" -> { data, body }
function frontMatter(raw, file) {
  const m = raw.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing front matter`);
  const data = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (!kv) continue;
    const v = kv[2].trim();
    data[kv[1]] = v.startsWith('"') ? JSON.parse(v) : v === "true" ? true : v === "false" ? false : v;
  }
  return { data, body: m[2] };
}

const fill = (html) => html.replace(/\{\{(\w+)\}\}/g, (all, k) => (k in LINKS ? LINKS[k] : all));

// ------------------------------------------------------------ shared pieces
const stamp = (f) => crypto.createHash("sha256").update(fs.readFileSync(p("public", "assets", f))).digest("hex").slice(0, 10);
const layout = fs.readFileSync(p("src", "layout.html"), "utf8")
  .replace("/assets/site.css", `/assets/site.css?v=${stamp("site.css")}`)
  .replace("/assets/site.js", `/assets/site.js?v=${stamp("site.js")}`);
const partial = (name) => fill(fs.readFileSync(p("src", "partials", `${name}.html`), "utf8"));
const header = partial("header");
const enquiryForm = partial("enquiry-form");
const footer = partial("footer").replace("{{year}}", String(new Date().getFullYear()));

const BUSINESS_ID = `${SITE}/#business`;
const PERSON_ID = `${SITE}/#james-berry`;
const businessLd = {
  "@type": ["LocalBusiness", "MusicGroup"],
  "@id": BUSINESS_ID,
  name: "UK Organist – Jay Berry",
  legalName: "UK Organist Limited",
  alternateName: "Jay Berry, Organist",
  url: `${SITE}/`,
  logo: `${SITE}/assets/logo-emblem-1024.png`,
  image: `${SITE}/assets/og-default.png`,
  description:
    "Professional church organist for weddings, funerals, memorial services, concerts and choral services across Lancashire and Greater Manchester. Over 30 years' experience.",
  telephone: "+447359670332",
  email: LINKS.email,
  address: { "@type": "PostalAddress", addressRegion: "Lancashire", addressCountry: "GB" },
  areaServed: AREAS.map((name) => ({ "@type": "Place", name })),
  founder: { "@id": PERSON_ID },
  genre: ["Church music", "Sacred music", "Classical organ"],
  priceRange: "££",
  knowsAbout: ["Wedding music", "Funeral music", "Hymn accompaniment", "Choral Evensong", "Pipe organ"],
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+447359670332",
    contactType: "bookings",
    areaServed: "GB",
    availableLanguage: "English",
  },
};
const personLd = {
  "@type": "Person",
  "@id": PERSON_ID,
  name: "Jay Berry",
  jobTitle: "Organist and Choir Master",
  worksFor: { "@id": BUSINESS_ID },
  affiliation: { "@type": "Church", name: "St John the Evangelist, Worsthorne" },
  url: `${SITE}/about/`,
};
const websiteLd = { "@type": "WebSite", "@id": `${SITE}/#website`, url: `${SITE}/`, name: BRAND, inLanguage: "en-GB", publisher: { "@id": BUSINESS_ID } };

function pageLd({ urlPath, title, crumb, service, description, body }) {
  const graph = [businessLd, personLd, websiteLd];
  if (urlPath !== "/") {
    const parts = urlPath.split("/").filter(Boolean);
    const items = [{ "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` }];
    if (parts.length > 1) items.push({ "@type": "ListItem", position: 2, name: "Areas covered", item: `${SITE}/${parts[0]}/` });
    items.push({ "@type": "ListItem", position: items.length + 1, name: crumb || title, item: SITE + urlPath });
    graph.push({ "@type": "BreadcrumbList", itemListElement: items });
  }
  if (service) {
    graph.push({
      "@type": "Service",
      name: service,
      serviceType: service,
      description,
      provider: { "@id": BUSINESS_ID },
      areaServed: AREAS.map((name) => ({ "@type": "Place", name })),
      url: SITE + urlPath,
    });
  }
  const faqs = [...body.matchAll(/<details class="faq">\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)];
  if (faqs.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faqs.map(([, q, a]) => ({
        "@type": "Question",
        name: strip(q),
        acceptedAnswer: { "@type": "Answer", text: strip(fill(a)) },
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

function render({ urlPath, title, description, nav, noindex, crumb, service, body }) {
  const url = SITE + urlPath;
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    noindex ? `<meta name="robots" content="noindex">` : `<meta name="robots" content="index, follow, max-image-preview:large">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="en_GB">`,
    `<meta property="og:site_name" content="${BRAND}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${SITE}/assets/og-default.png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="UK Organist – Jay Berry, wedding and funeral organist">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="geo.region" content="GB-LAN">`,
    `<script type="application/ld+json">${JSON.stringify(pageLd({ urlPath, title, crumb, service, description, body })).replace(/</g, "\\u003c")}</script>`,
  ].join("\n");
  const nav_ = header.replace(new RegExp(`data-nav="${nav}"`, "g"), `data-nav="${nav}" aria-current="page"`);
  return fill(layout)
    .replace("<!--@HEAD-->", head)
    .replace("<!--@HEADER-->", nav_)
    .replace("<!--@MAIN-->", fill(body).replace("<!--@ENQUIRY_FORM-->", enquiryForm))
    .replace("<!--@FOOTER-->", footer);
}

// Links to other websites open in a new tab (tel:, mailto: and our own pages don't).
const externalNewTab = (html) =>
  html.replace(/<a\b([^>]*?)\shref="(https?:\/\/[^"]+)"([^>]*)>/g, (tag, before, href, after) => {
    if (href.startsWith(SITE) || /\starget=/.test(before + after)) return tag;
    return `<a${before} href="${href}" target="_blank" rel="noopener"${after}>`;
  });

// Content hash on image/icon URLs so a replaced file shows straight away.
const assetHash = {};
const stampAssets = (html) =>
  html.replace(/(src|href)="(\/assets\/[^"?#]+\.(?:webp|png|jpg|svg|ico))"/g, (all, attr, url) => {
    const f = p("public", url);
    if (!fs.existsSync(f)) return all;
    assetHash[url] ??= crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 10);
    return `${attr}="${url}?v=${assetHash[url]}"`;
  });

// ------------------------------------------------------------ build
fs.rmSync(OUT, { recursive: true, force: true });
copyDir(p("public"), OUT);
const sitemap = [];
const problems = [];

for (const rel of listFiles(p("src", "pages"), ".html")) {
  const { data, body } = frontMatter(fs.readFileSync(p("src", "pages", rel), "utf8"), rel);
  for (const key of ["title", "description"]) if (!data[key]) throw new Error(`${rel}: front matter needs "${key}"`);
  if (data.title.length > 65) problems.push(`title over 65 characters (${data.title.length}) in ${rel}`);
  if (data.description.length > 165 || data.description.length < 70)
    problems.push(`description should be 70-165 characters (${data.description.length}) in ${rel}`);
  const name = rel.replace(/\.html$/, "").split(path.sep).join("/");
  const urlPath = name === "index" ? "/" : name === "404" ? "/404" : `/${name}/`;
  const outFile = name === "index" || name === "404" ? `${name}.html` : `${name}/index.html`;
  const h1s = (body.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) problems.push(`${rel} has ${h1s} <h1> headings (needs exactly 1)`);
  fs.mkdirSync(path.dirname(path.join(OUT, outFile)), { recursive: true });
  fs.writeFileSync(path.join(OUT, outFile), stampAssets(externalNewTab(render({ urlPath, ...data, body }))));
  if (!data.noindex && name !== "404") sitemap.push([urlPath, fs.statSync(p("src", "pages", rel)).mtime.toISOString()]);
}

fs.writeFileSync(
  path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    sitemap
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([loc, mod]) => `  <url><loc>${SITE}${loc}</loc><lastmod>${mod}</lastmod></url>`)
      .join("\n") +
    `\n</urlset>\n`,
);

// ------------------------------------------------------------ checks
const exists = (href) => {
  const clean = decodeURI(href.split(/[?#]/)[0]);
  if (clean === "/") return true;
  const f = path.join(OUT, clean);
  if (clean.endsWith("/")) return fs.existsSync(path.join(f, "index.html"));
  return fs.existsSync(f) && fs.statSync(f).isFile();
};
const BANNED = [/441204913708/, /bandpencil/i, /\bTBC\b/i, /Lorem/i, /Tech Health/i, /\{\{/];
for (const rel of listFiles(OUT, ".html")) {
  const html = fs.readFileSync(path.join(OUT, rel), "utf8").replace(/<!--[\s\S]*?-->/g, "");
  for (const m of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    if (!exists(m[1])) problems.push(`broken link: ${m[1]} (in ${rel})`);
    else if (!/\.\w+$/.test(m[1].split(/[?#]/)[0]) && !m[1].split(/[?#]/)[0].endsWith("/"))
      problems.push(`link without trailing slash: ${m[1]} (in ${rel})`);
  }
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/href="(?:\/[^"#]*)?#([^"]+)"/g)) {
    const target = m[0].match(/href="(\/[^"#]*)#/)?.[1];
    if (target && target !== "/" + path.dirname(rel).replace(/^\.$/, "") + (path.dirname(rel) === "." ? "" : "/")) {
      const tf = path.join(OUT, target, target.endsWith("/") ? "index.html" : "");
      if (fs.existsSync(tf) && !fs.readFileSync(tf, "utf8").includes(`id="${m[1]}"`)) problems.push(`missing anchor: ${target}#${m[1]} (in ${rel})`);
    } else if (!ids.has(m[1])) problems.push(`missing anchor: #${m[1]} (in ${rel})`);
  }
  if (/<!--@\w+-->/.test(html)) problems.push(`unfilled placeholder in ${rel}`);
  for (const re of BANNED) if (re.test(html)) problems.push(`site rule: ${re} found in ${rel}`);
}
if (problems.length) {
  for (const msg of problems) console.error(msg);
  process.exit(1);
}
console.log(`built ${sitemap.length} sitemap URLs -> dist/`);
