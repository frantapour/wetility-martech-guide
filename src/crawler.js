// Website crawler: reads public pages of the company website and reports what code is installed and the main SEO elements.
// Configuration only: it reads public HTML, never submits forms or reads customer data.
const UA = "Mozilla/5.0 (compatible; WetilityMarTechGuide/1.0; +internal audit)";
const MAX_PAGES = 80, CONCURRENCY = 4;
async function get(url, timeout = 15000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout); const t0 = Date.now();
  try { const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xml;q=0.9,*/*;q=0.8" }, redirect: "follow", signal: ctl.signal });
    const body = await r.text(); return { status: r.status, url: r.url, body, ms: Date.now() - t0, type: r.headers.get("content-type") || "" };
  } catch (e) { return { status: 0, url, body: "", ms: Date.now() - t0, error: e.name === "AbortError" ? "timeout" : e.message }; } finally { clearTimeout(t); }
}
const dec = s => String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const strip = s => dec(String(s || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const attr = (tag, name) => { const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")); return m ? dec(m[2] ?? m[3] ?? m[4] ?? "") : null; };
const metaBy = (html, key, val) => { for (const m of html.matchAll(/<meta\b[^>]*>/gi)) if ((attr(m[0], key) || "").toLowerCase() === val) return attr(m[0], "content"); return null; };
const ID_RULES = [
  ["GTM container", /\b(GTM-[A-Z0-9]{5,10})\b/g], ["GA4", /\b(G-[A-Z0-9]{8,12})\b/g], ["Google Ads", /\b(AW-\d{8,12})\b/g], ["Floodlight", /\b(DC-\d{6,12})\b/g],
  ["Meta pixel", /fbq\(\s*['"]init['"]\s*,\s*['"](\d{8,20})/g], ["TikTok pixel", /ttq\.load\(\s*['"]([A-Z0-9]{12,30})/g],
  ["Clarity", /clarity\.ms\/tag\/([a-z0-9]{6,14})/gi], ["Hotjar", /hjid\s*:\s*(\d{5,10})/g], ["Freshworks (Freshsales) script", /fw-cdn\.com\/(\d+\/\d+)\.js/g],
  ["Amplitude key", /amplitude[\s\S]{0,80}?['"]([a-f0-9]{32})['"]/g], ["LinkedIn partner", /_linkedin_partner_id\s*=\s*['"]?(\d{4,12})/g], ["Bing UET", /\bti\s*:\s*['"]?(\d{5,12})/g]
];
function analyse(html, url) {
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [""])[0];
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(m => ({ src: attr(m[1], "src"), type: attr(m[1], "type"), inline: m[2] }));
  const ext = [...new Set(scripts.filter(s => s.src).map(s => { try { return new URL(s.src, url).hostname; } catch (e) { return s.src; } }))];
  const allCode = scripts.map(s => (s.src || "") + "\n" + (s.inline || "")).join("\n") + "\n" + [...html.matchAll(/<iframe\b[^>]*>/gi)].map(m => m[0]).join("\n");
  const ids = []; for (const [k, re] of ID_RULES) { re.lastIndex = 0; let m; while ((m = re.exec(allCode))) if (!ids.some(x => x.k === k && x.id === m[1])) ids.push({ k, id: m[1] }); }
  const jsonld = scripts.filter(s => (s.type || "").includes("ld+json")).flatMap(s => { try { const j = JSON.parse(s.inline); const arr = Array.isArray(j) ? j : j["@graph"] || [j]; return arr.map(x => x["@type"]).flat().filter(Boolean); } catch (e) { return ["(invalid JSON-LD)"]; } });
  const h = n => [...html.matchAll(new RegExp(`<h${n}\\b[^>]*>([\\s\\S]*?)<\\/h${n}>`, "gi"))].map(m => strip(m[1])).filter(Boolean);
  const body = (html.match(/<body[\s\S]*<\/body>/i) || [html])[0];
  const links = [...body.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)[^"']*["'][^>]*>/gi)].map(m => m[1]);
  const imgs = [...body.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  return {
    title: strip((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ""), description: metaBy(head, "name", "description"),
    canonical: (() => { for (const m of head.matchAll(/<link\b[^>]*>/gi)) if ((attr(m[0], "rel") || "").toLowerCase() === "canonical") return attr(m[0], "href"); return null; })(),
    robots: metaBy(head, "name", "robots"), viewport: metaBy(head, "name", "viewport"), ogImage: metaBy(head, "property", "og:image"), ogTitle: metaBy(head, "property", "og:title"),
    lang: attr((html.match(/<html\b[^>]*>/i) || [""])[0], "lang"), hreflang: [...head.matchAll(/<link\b[^>]*hreflang[^>]*>/gi)].length,
    h1: h(1), h2: h(2).length, words: strip(body).split(" ").filter(w => /[a-z]/i.test(w)).length, bytes: html.length,
    scriptCount: scripts.length, extHosts: ext, ids, jsonld: [...new Set(jsonld)], imgs: imgs.length, imgsNoAlt: imgs.filter(t => attr(t, "alt") == null || attr(t, "alt") === "").length,
    nextjs: /__NEXT_DATA__|\/_next\/static/.test(html), gtmNoscript: /googletagmanager\.com\/ns\.html/.test(html), links
  };
}
async function crawl(domain) {
  const root = "https://" + String(domain || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const report = [], issues = [], items = [];
  const robots = await get(root + "/robots.txt");
  const disallow = robots.status === 200 ? [...robots.body.matchAll(/^\s*Disallow:\s*(\S+)/gim)].map(m => m[1]) : [];
  const sitemapUrls = robots.status === 200 ? [...robots.body.matchAll(/^\s*Sitemap:\s*(\S+)/gim)].map(m => m[1]) : [];
  report.push({ part: "robots.txt", ok: robots.status === 200, count: disallow.length, note: robots.status === 200 ? `${disallow.length} disallow rules, ${sitemapUrls.length} sitemap(s) listed` : "", error: robots.status === 200 ? undefined : `HTTP ${robots.status || robots.error}` });
  let urls = []; const seenMaps = new Set(); const queue = sitemapUrls.length ? sitemapUrls : [root + "/sitemap.xml"];
  while (queue.length && seenMaps.size < 10) { const sm = queue.shift(); if (seenMaps.has(sm)) continue; seenMaps.add(sm); const r = await get(sm); if (r.status !== 200) continue;
    const locs = [...r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => dec(m[1])); if (/<sitemapindex/i.test(r.body)) queue.push(...locs); else urls.push(...locs); }
  urls = [...new Set(urls)];
  report.push({ part: "Sitemap", ok: urls.length > 0, count: urls.length, error: urls.length ? undefined : "No sitemap found or it is empty" });
  const home = await get(root + "/");
  if (home.status !== 200) { report.push({ part: "Home page", ok: false, error: `HTTP ${home.status || home.error}` }); return { items, report, issues, pages: [] }; }
  const homeA = analyse(home.body, home.url);
  const internal = homeA.links.map(l => { try { const u = new URL(l, home.url); return u.hostname.replace(/^www\./, "") === new URL(root).hostname.replace(/^www\./, "") ? u.origin + u.pathname : null; } catch (e) { return null; } }).filter(Boolean);
  const toVisit = [...new Set([home.url, ...urls, ...internal])].filter(u => { const p = new URL(u).pathname; return !disallow.some(d => d !== "/" && d && p.startsWith(d)) && !/\.(pdf|jpg|jpeg|png|webp|svg|zip|xml)$/i.test(p); }).slice(0, MAX_PAGES);
  const pages = []; let i = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (i < toVisit.length) { const u = toVisit[i++]; const r = u === home.url ? home : await get(u);
    pages.push({ url: u, final: r.url, status: r.status, ms: r.ms, error: r.error, a: r.status === 200 && /html/.test(r.type || "text/html") ? analyse(r.body, r.url) : null }); } }));
  pages.sort((x, y) => x.url.localeCompare(y.url));
  const ok = pages.filter(p => p.a);
  report.push({ part: "Pages crawled", ok: true, count: ok.length, note: `${pages.length - ok.length} failed or not HTML` });
  const path = u => { try { return new URL(u).pathname || "/"; } catch (e) { return u; } };
  // registry items: one per page, one per tracking ID / external script host
  ok.forEach(p => items.push({ system: "umbraco", container: "Website crawl", kind: "page", name: path(p.final || p.url), label: p.a.title || "", parent: p.a.h1[0] || "", description: `HTTP ${p.status}, ${p.ms} ms, ${p.a.words} words, H1 x${p.a.h1.length}, canonical ${p.a.canonical ? "yes" : "no"}, og:image ${p.a.ogImage ? "yes" : "no"}, JSON-LD ${p.a.jsonld.join("/") || "none"}, ${p.a.scriptCount} scripts.` }));
  const idMap = {}; ok.forEach(p => p.a.ids.forEach(x => { const k = x.k + " " + x.id; (idMap[k] ||= { ...x, pages: [] }).pages.push(path(p.url)); }));
  Object.values(idMap).forEach(x => items.push({ system: "umbraco", container: "Website crawl", kind: "tracking code", name: x.id, label: `${x.k} ${x.id}`, parent: "Hard-coded on pages", description: `Found in the page HTML (not only via GTM) on ${x.pages.length} of ${ok.length} pages, e.g. ${x.pages.slice(0, 4).join(", ")}.` }));
  const hostMap = {}; ok.forEach(p => p.a.extHosts.forEach(hn => (hostMap[hn] ||= []).push(path(p.url))));
  Object.entries(hostMap).forEach(([hn, ps]) => items.push({ system: "umbraco", container: "Website crawl", kind: "script source", name: hn, label: "", parent: "External script hosts", description: `Script loaded from ${hn} on ${ps.length} of ${ok.length} pages.` }));
  // findings
  const cnt = f => ok.filter(f).length, list = f => ok.filter(f).map(p => path(p.url)).slice(0, 12).join(", ");
  const F = (title, n, detail) => { if (n) issues.push([title, n, detail]); };
  F("Pages without an H1", cnt(p => !p.a.h1.length), list(p => !p.a.h1.length));
  F("Pages with more than one H1", cnt(p => p.a.h1.length > 1), list(p => p.a.h1.length > 1));
  F("Pages without a canonical tag", cnt(p => !p.a.canonical), list(p => !p.a.canonical));
  F("Pages without a meta description", cnt(p => !p.a.description), list(p => !p.a.description));
  F("Pages without og:image", cnt(p => !p.a.ogImage), list(p => !p.a.ogImage));
  F("Pages marked noindex", cnt(p => /noindex/i.test(p.a.robots || "")), list(p => /noindex/i.test(p.a.robots || "")));
  F("Pages with under 200 words", cnt(p => p.a.words < 200), list(p => p.a.words < 200));
  F("Pages slower than 2 seconds to respond", cnt(p => p.ms > 2000), list(p => p.ms > 2000));
  F("Images without alt text", ok.reduce((n, p) => n + p.a.imgsNoAlt, 0), list(p => p.a.imgsNoAlt > 0));
  F("Pages with no structured data (JSON-LD)", cnt(p => !p.a.jsonld.length), "");
  F("Viewport blocks zoom (maximum-scale=1)", cnt(p => /maximum-scale\s*=\s*1(\.0)?\b|user-scalable\s*=\s*no/i.test(p.a.viewport || "")), "");
  const titles = {}; ok.forEach(p => (titles[p.a.title] ||= []).push(path(p.url))); const dupT = Object.entries(titles).filter(([t, ps]) => t && ps.length > 1);
  F("Duplicate page titles", dupT.length, dupT.slice(0, 6).map(([t, ps]) => `"${t}" on ${ps.join(", ")}`).join("; "));
  F("Pages in the sitemap that did not return 200", pages.filter(p => !p.a && urls.includes(p.url)).length, pages.filter(p => !p.a && urls.includes(p.url)).map(p => `${path(p.url)} (${p.status || p.error})`).slice(0, 10).join(", "));
  issues.forEach(([t, n]) => report.push({ part: t, ok: true, count: n, note: "to fix" }));
  return { items, report, issues, pages: ok.map(p => ({ path: path(p.url), status: p.status, ms: p.ms, title: p.a.title, h1: p.a.h1, words: p.a.words, canonical: p.a.canonical, ogImage: !!p.a.ogImage, jsonld: p.a.jsonld, ids: p.a.ids.map(x => x.k + " " + x.id), hosts: p.a.extHosts, nextjs: p.a.nextjs })), robots: robots.status === 200 ? robots.body.slice(0, 2000) : null, sitemapCount: urls.length };
}
module.exports = { crawl };
