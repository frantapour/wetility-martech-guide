// Platform connections: encrypted credential storage, connection tests, and syncs that pull configuration
// (never customer records) into the tracking registry. One connector per platform; all share the same
// storage, routes and registry-merge logic.
const crypto = require("crypto");
const { q, pool } = require("./db");
const Importer = require("../public/importer.js");

// ---------- secrets ----------
const SECRET = crypto.createHash("sha256").update(process.env.SETTINGS_KEY || process.env.SESSION_SECRET || "dev-only-key").digest();
const enc = text => { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv("aes-256-gcm", SECRET, iv); const out = Buffer.concat([c.update(text, "utf8"), c.final()]); return [iv, c.getAuthTag(), out].map(b => b.toString("base64")).join("."); };
const dec = blob => { const [iv, tag, data] = blob.split(".").map(s => Buffer.from(s, "base64")); const d = crypto.createDecipheriv("aes-256-gcm", SECRET, iv); d.setAuthTag(tag); return Buffer.concat([d.update(data), d.final()]).toString("utf8"); };
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });

// ---------- HTTP ----------
async function http(url, { method = "GET", headers = {}, body, label = "The platform" } = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(url, { method, headers: { Accept: "application/json", ...(body && typeof body !== "string" ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined, signal: ctl.signal });
    const text = await r.text(); let j = null; try { j = text ? JSON.parse(text) : {}; } catch (e) { j = null; }
    const msg = j && (j.error?.message || j.error_description || j.message || (typeof j.error === "string" ? j.error : ""));
    if (r.status === 401 || r.status === 403) throw fail(`${label} rejected the credentials (${r.status})${msg ? ": " + msg : ""}.`);
    if (r.status === 404) throw fail(`${label} could not find that resource (404)${msg ? ": " + msg : ""}. Check the IDs.`, 404);
    if (r.status === 429) throw fail(`${label} rate limit reached. Try again in a minute.`, 429);
    if (!r.ok) throw fail(`${label} returned ${r.status}${msg ? ": " + msg : ""}.`, 502);
    if (j === null) throw fail(`${label} returned something that is not JSON. Check the domain or URL.`, 502);
    return j;
  } catch (e) {
    if (e.name === "AbortError") throw fail(`${label} did not answer within 25 seconds.`, 504);
    if (e.status) throw e;
    throw fail(`Could not reach ${label}. Check the domain or URL.`, 502);
  } finally { clearTimeout(t); }
}

// ---------- Google auth ----------
const b64u = b => Buffer.from(b).toString("base64url");
async function googleTokenFromServiceAccount(saJson, scopes) {
  let sa; try { sa = JSON.parse(saJson); } catch (e) { throw fail("The service-account key is not valid JSON. Paste the whole downloaded .json file."); }
  if (!sa.client_email || !sa.private_key) throw fail("The service-account key is missing client_email or private_key.");
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(JSON.stringify({ iss: sa.client_email, scope: scopes.join(" "), aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3300 }));
  const sig = crypto.sign("RSA-SHA256", Buffer.from(head + "." + claim), sa.private_key).toString("base64url");
  const j = await http("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${sig}` }).toString(), label: "Google sign-in" });
  return { token: j.access_token, email: sa.client_email };
}
async function googleTokenFromRefresh(c) {
  const j = await http("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refreshToken }).toString(), label: "Google sign-in" });
  return j.access_token;
}
const ids = s => String(s || "").split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
const digits = s => String(s || "").replace(/\D/g, "");

// Freshsales returns untranslated keys for custom field groups, e.g. "Translation Missing: En.Fields.Cf Sales Funnel.Label".
const groupName = g => { const m = String(g || "").match(/^Translation Missing: En\.Fields\.(?:Cf )?(.+?)\.Label$/i); return (m ? m[1] : String(g || "")).replace(/\s+/g, " ").trim(); };

// ---------- connectors ----------
// Each: id, name, systems, intro, fields [{key,label,secret,placeholder,help,type}], test(c) -> message, sync(c) -> {items, report, issues?}
const CONNECTORS = [
  {
    id: "freshsales", name: "Freshsales", systems: ["freshsales"],
    intro: "Field definitions for Contacts, Deals and Accounts, lifecycle stages and deal pipelines. Never reads contacts or deals.",
    fields: [
      { key: "domain", label: "Freshsales domain", placeholder: "wetility.myfreshworks.com", default: "wetility.myfreshworks.com", help: "The address you use to open Freshsales." },
      { key: "apiKey", label: "API key", secret: true, help: "Freshsales: profile picture → Profile settings → API settings. Acts with that user's permissions; use an admin-owned account, not a personal or agency one." }
    ],
    _call(c, path) { const d = String(c.domain || "").replace(/^https?:\/\//, "").replace(/\/.*$/, ""); if (!d || !c.apiKey) throw fail("Save the domain and API key first."); return http(`https://${d}/crm/sales/api${path}`, { headers: { Authorization: `Token token=${c.apiKey}` }, label: "Freshsales" }); },
    async test(c) { const j = await this._call(c, "/settings/contacts/fields"); return `Connected. ${(j.fields || []).length} contact fields visible.`; },
    async sync(c) {
      const items = [], report = [];
      const fieldItems = (json, container) => { const groups = Object.fromEntries((json.field_groups || []).map(g => [g.id, g.name]));
        return (json.fields || []).filter(f => f && f.name).map(f => ({ system: "freshsales", container, kind: f.default === false || /^cf_/.test(f.name) ? "custom field" : "field", name: f.name, label: f.label && f.label.trim() !== f.name ? f.label.trim() : "",
          parent: groupName(groups[f.field_group_id] || f.field_group?.name || ""), description: ["Synced from Freshsales API", f.type && `type ${f.type}`, f.required && "required", Array.isArray(f.choices) && f.choices.length ? `${f.choices.length} choices` : ""].filter(Boolean).join(", ") })); };
      for (const [container, path] of [["Contacts", "/settings/contacts/fields?include=field_group"], ["Deals", "/settings/deals/fields?include=field_group"], ["Accounts", "/settings/sales_accounts/fields?include=field_group"]]) {
        try { const got = fieldItems(await this._call(c, path), container); items.push(...got); report.push({ part: container, ok: true, count: got.length }); }
        catch (e) { report.push({ part: container, ok: false, error: e.message }); if (e.status === 400) return { items, report }; }
      }
      try { const st = (await this._call(c, "/selector/lifecycle_stages")).lifecycle_stages || [];
        st.forEach(x => items.push({ system: "freshsales", container: "Lifecycle stages", kind: "lifecycle stage", name: Importer.slug(x.name), label: x.name, parent: x.type || "", description: "Synced from Freshsales API" }));
        report.push({ part: "Lifecycle stages", ok: true, count: st.length }); } catch (e) { report.push({ part: "Lifecycle stages", ok: false, error: e.message }); }
      try { const pipes = (await this._call(c, "/selector/deal_pipelines")).deal_pipelines || []; let n = 0;
        for (const p of pipes) { let stages = Array.isArray(p.deal_stages) ? p.deal_stages : null;
          if (!stages) { try { stages = (await this._call(c, `/selector/deal_pipelines/${p.id}/deal_stages`)).deal_stages || []; } catch (e) { stages = []; } }
          stages.forEach(x => { n++; items.push({ system: "freshsales", container: `Pipeline: ${p.name}`, kind: "deal stage", name: Importer.slug(x.name), label: x.name, parent: p.name, description: `Synced from Freshsales API${x.probability != null ? `, probability ${x.probability}%` : ""}` }); }); }
        report.push({ part: "Deal pipelines", ok: true, count: n, note: `${pipes.length} pipelines` }); } catch (e) { report.push({ part: "Deal pipelines", ok: false, error: e.message }); }
      return { items, report };
    }
  },
  {
    id: "google", name: "Google (Tag Manager, GA4, Firebase)", systems: ["gtm", "ga4", "firebase"],
    intro: "Live GTM container (tags, triggers, variables), GA4 key events, custom dimensions, data streams (web and Firebase app) and the events that actually fired in the last 30 days.",
    fields: [
      { key: "serviceAccount", label: "Service-account key (JSON)", secret: true, type: "textarea", help: "Google Cloud console → IAM → Service accounts → create one in a Wetility-owned project → Keys → Add key → JSON. Enable the Tag Manager API, Google Analytics Admin API and Google Analytics Data API. Then add the service account's email as a Read user in GTM and a Viewer on the GA4 property." },
      { key: "gtmContainers", optional: true, label: "GTM containers", placeholder: "accounts/123456/containers/7890123", help: "Separate several with commas, each as accounts/{account id}/containers/{container id} (both numbers are in the GTM address bar). Leave blank to read every container the service account can see." },
      { key: "ga4Properties", optional: true, label: "GA4 property IDs", placeholder: "123456789", help: "Numbers only, separated by commas (GA4 Admin → Property settings). Leave blank to read every property the service account can see." }
    ],
    async _token(c) { if (!c.serviceAccount) throw fail("Save the service-account key first."); return googleTokenFromServiceAccount(c.serviceAccount, ["https://www.googleapis.com/auth/tagmanager.readonly", "https://www.googleapis.com/auth/analytics.readonly"]); },
    async test(c) { const { token, email } = await this._token(c); const h = { Authorization: `Bearer ${token}` }; const out = [];
      try { const a = await http("https://tagmanager.googleapis.com/tagmanager/v2/accounts", { headers: h, label: "Tag Manager" }); out.push(`${(a.account || []).length} GTM account(s)`); } catch (e) { out.push(`GTM: ${e.message}`); }
      try { const s = await http("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", { headers: h, label: "GA4" }); out.push(`${(s.accountSummaries || []).reduce((n, x) => n + (x.propertySummaries || []).length, 0)} GA4 propert(ies)`); } catch (e) { out.push(`GA4: ${e.message}`); }
      return `Signed in as ${email}. Visible: ${out.join("; ")}.`; },
    async sync(c) {
      const { token } = await this._token(c); const h = { Authorization: `Bearer ${token}` }; const items = [], report = [];
      let containers = ids(c.gtmContainers).map(s => s.replace(/^\/+|\/+$/g, ""));
      if (!containers.length) { try { const a = await http("https://tagmanager.googleapis.com/tagmanager/v2/accounts", { headers: h, label: "Tag Manager" });
        for (const acc of a.account || []) { const cs = await http(`https://tagmanager.googleapis.com/tagmanager/v2/${acc.path}/containers`, { headers: h, label: "Tag Manager" }); (cs.container || []).forEach(x => containers.push(x.path)); } } catch (e) { report.push({ part: "GTM", ok: false, error: e.message }); } }
      for (const path of containers) {
        try { const v = await http(`https://tagmanager.googleapis.com/tagmanager/v2/${path}/versions:live`, { headers: h, label: "Tag Manager" });
          const parsed = Importer.parseGTM(JSON.stringify({ containerVersion: v })); const cont = v.container?.publicId || parsed.container || path;
          parsed.items.forEach(i => items.push({ system: "gtm", container: cont, kind: i.kind, name: i.name, label: i.label, parent: i.parent, description: `Synced from GTM live version ${v.containerVersionId || ""}. ${i.description || ""}`.trim() }));
          report.push({ part: `GTM ${cont}`, ok: true, count: parsed.items.length, note: `live version ${v.containerVersionId || "?"}` });
        } catch (e) { report.push({ part: `GTM ${path}`, ok: false, error: e.message }); }
      }
      let props = ids(c.ga4Properties).map(digits).filter(Boolean);
      if (!props.length) { try { const s = await http("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", { headers: h, label: "GA4" }); (s.accountSummaries || []).forEach(a => (a.propertySummaries || []).forEach(p => props.push(p.property.split("/")[1]))); } catch (e) { report.push({ part: "GA4", ok: false, error: e.message }); } }
      for (const pid of props) {
        const P = `properties/${pid}`; let n = 0;
        try {
          const ds = await http(`https://analyticsadmin.googleapis.com/v1beta/${P}/dataStreams?pageSize=200`, { headers: h, label: "GA4" });
          for (const s of ds.dataStreams || []) {
            const app = /APP/.test(s.type), sys = app ? "firebase" : "ga4";
            items.push({ system: sys, container: `GA4 ${pid}`, kind: "identifier", name: app ? (s.androidAppStreamData?.firebaseAppId || s.iosAppStreamData?.firebaseAppId || s.name) : (s.webStreamData?.measurementId || s.name), label: s.displayName || "", parent: "Data streams", description: `Synced from GA4 Admin API. ${s.type}${s.webStreamData?.defaultUri ? " " + s.webStreamData.defaultUri : ""}${app ? " (Firebase app stream)" : ""}` }); n++;
          }
          const ke = await http(`https://analyticsadmin.googleapis.com/v1beta/${P}/keyEvents?pageSize=200`, { headers: h, label: "GA4" });
          (ke.keyEvents || []).forEach(k => { items.push({ system: "ga4", container: `GA4 ${pid}`, kind: "key event", name: k.eventName, label: "", parent: "Key events", description: `Synced from GA4 Admin API. Counting: ${k.countingMethod || "?"}` }); n++; });
          const cd = await http(`https://analyticsadmin.googleapis.com/v1beta/${P}/customDimensions?pageSize=200`, { headers: h, label: "GA4" });
          (cd.customDimensions || []).forEach(d => { items.push({ system: "ga4", container: `GA4 ${pid}`, kind: d.scope === "USER" ? "user property" : "custom dimension", name: d.parameterName, label: d.displayName || "", parent: `Custom dimensions (${d.scope || "EVENT"})`, description: `Synced from GA4 Admin API. ${d.description || ""}`.trim() }); n++; });
          try { const rep = await http(`https://analyticsdata.googleapis.com/v1beta/${P}:runReport`, { method: "POST", headers: h, body: { dimensions: [{ name: "eventName" }, { name: "platform" }], metrics: [{ name: "eventCount" }], dateRanges: [{ startDate: "30daysAgo", endDate: "today" }], limit: 500 }, label: "GA4 reporting" });
            (rep.rows || []).forEach(r => { const name = r.dimensionValues[0].value, plat = r.dimensionValues[1].value, cnt = r.metricValues[0].value; items.push({ system: plat === "web" ? "ga4" : "firebase", container: `GA4 ${pid}`, kind: plat === "web" ? "event" : "event", name, label: "", parent: `Events fired (${plat}, last 30 days)`, description: `Synced from GA4 reporting: ${Number(cnt).toLocaleString("en-ZA")} events in the last 30 days on ${plat}.` }); n++; });
          } catch (e) { report.push({ part: `GA4 ${pid} events`, ok: false, error: e.message }); }
          report.push({ part: `GA4 ${pid}`, ok: true, count: n });
        } catch (e) { report.push({ part: `GA4 ${pid}`, ok: false, error: e.message }); }
      }
      if (!containers.length && !props.length) report.push({ part: "Google", ok: false, error: "No GTM containers or GA4 properties visible to this service account. Add its email in GTM (Read) and GA4 (Viewer)." });
      return { items, report };
    }
  },
  {
    id: "meta", name: "Meta (Business portfolio, ad accounts, datasets)", systems: ["meta"],
    intro: "Who owns what: ad accounts and pixels/datasets owned by Wetility versus shared with it by another business, the events each dataset receives, pages and partner agencies. Anything Wetility uses but does not own is logged as a problem.",
    fields: [
      { key: "businessId", label: "Business portfolio ID", placeholder: "1234567890", help: "Meta Business Settings → Business info. The number in the address bar after business_id=." },
      { key: "token", label: "System-user access token", secret: true, help: "Business Settings → Users → System users → add an Admin system user owned by Wetility → Generate token with business_management and ads_read. Assign it the ad accounts and datasets." },
      { key: "version", optional: true, label: "Graph API version", placeholder: "v26.0", help: "Leave as v26.0 unless Meta retires it." }
    ],
    _g(c, path) { if (!c.token || !c.businessId) throw fail("Save the business ID and token first."); const v = c.version || "v26.0"; return http(`https://graph.facebook.com/${v}/${path}${path.includes("?") ? "&" : "?"}limit=200`, { headers: { Authorization: `Bearer ${c.token}` }, label: "Meta" }); },
    async test(c) { const b = await this._g(c, `${digits(c.businessId)}?fields=name,verification_status`); return `Connected to "${b.name}" (verification: ${b.verification_status || "unknown"}).`; },
    async sync(c) {
      const bid = digits(c.businessId), items = [], report = [], issues = [];
      const biz = await this._g(c, `${bid}?fields=name`);
      const pull = async (part, path, fn) => { try { const j = await this._g(c, path); (j.data || []).forEach(fn); report.push({ part, ok: true, count: (j.data || []).length }); } catch (e) { report.push({ part, ok: false, error: e.message }); } };
      await pull("Owned ad accounts", `${bid}/owned_ad_accounts?fields=name,account_id,account_status`, a => items.push({ system: "meta", container: "Ad accounts", kind: "integration", name: `act_${a.account_id}`, label: a.name, parent: "Owned by Wetility", description: `Owned by ${biz.name}. Status ${a.account_status}. Synced from Meta.` }));
      await pull("Shared ad accounts", `${bid}/client_ad_accounts?fields=name,account_id,account_status,business{name,id}`, a => { items.push({ system: "meta", container: "Ad accounts", kind: "integration", name: `act_${a.account_id}`, label: a.name, parent: "Shared with Wetility (not owned)", description: `Owned by ${a.business?.name || "another business"} (${a.business?.id || "?"}), shared with ${biz.name}. Synced from Meta.` });
        issues.push(["pb42", "Step 3", "high", `Meta ad account ${a.name} (act_${a.account_id}) is not owned by Wetility`, `Owned by ${a.business?.name || "another business"} (${a.business?.id || "?"}) and only shared with ${biz.name}. Found by the Meta sync. See playbook 4.2: request handover or recreate under Wetility.`]); });
      const pixelEvents = async (p, owned) => { let ev = [];
        try { const s = await this._g(c, `${p.id}/stats?aggregation=event`); (s.data || []).forEach(b => (b.data || []).forEach(d => { if (!ev.includes(d.value)) ev.push(d.value); })); } catch (e) { /* stats need ads_read on the dataset */ }
        items.push({ system: "meta", container: `Dataset ${p.name || p.id}`, kind: "integration", name: p.id, label: p.name, parent: owned ? "Owned by Wetility" : "Shared with Wetility (not owned)", description: `${owned ? "Owned by " + biz.name : "Owned by " + (p.owner_business?.name || "another business")}. Last fired ${p.last_fired_time || "unknown"}. Synced from Meta.` });
        ev.forEach(e => items.push({ system: "meta", container: `Dataset ${p.name || p.id}`, kind: /^[A-Z]/.test(e) ? "standard event" : "custom event", name: e, label: "", parent: "Events received", description: "Event seen on this dataset (Meta stats). Synced from Meta." }));
        if (!owned) issues.push(["pb42", "Step 3", "high", `Meta dataset/pixel ${p.name || p.id} is not owned by Wetility`, `Owned by ${p.owner_business?.name || "another business"} and shared with ${biz.name}. Events seen: ${ev.join(", ") || "none read"}. Found by the Meta sync.`]); };
      try { const o = await this._g(c, `${bid}/owned_pixels?fields=name,id,last_fired_time,owner_business{name}`); for (const p of o.data || []) await pixelEvents(p, true); report.push({ part: "Owned datasets", ok: true, count: (o.data || []).length }); } catch (e) { report.push({ part: "Owned datasets", ok: false, error: e.message }); }
      try { const o = await this._g(c, `${bid}/client_pixels?fields=name,id,last_fired_time,owner_business{name}`); for (const p of o.data || []) await pixelEvents(p, false); report.push({ part: "Shared datasets", ok: true, count: (o.data || []).length }); } catch (e) { report.push({ part: "Shared datasets", ok: false, error: e.message }); }
      await pull("Pages", `${bid}/owned_pages?fields=name,id`, p => items.push({ system: "meta", container: "Pages", kind: "integration", name: p.id, label: p.name, parent: "Owned by Wetility", description: "Page owned by the Wetility portfolio. Synced from Meta." }));
      await pull("Partner agencies", `${bid}/agencies?fields=name,id`, a => items.push({ system: "meta", container: "Partners", kind: "integration", name: a.id, label: a.name, parent: "Partners with access", description: "Business with partner access to Wetility assets. Remove when the engagement ends (playbook 4.12). Synced from Meta." }));
      return { items, report, issues };
    }
  },
  {
    id: "zuper", name: "Zuper", systems: ["zuper"],
    intro: "Webhooks configured in Zuper (module, event, destination, status). Job statuses and custom fields still come from copy-paste: Zuper's API does not document a list endpoint for them.",
    fields: [
      { key: "baseUrl", label: "API base URL", placeholder: "https://us-west-1c.zuperpro.com/api", help: "Your region's address. Ask Zuper support or Josh; it ends in /api." },
      { key: "apiKey", label: "API key", secret: true, help: "Zuper: Settings → Developer Hub → API keys. Use a key from a Wetility admin account." }
    ],
    _z(c, path) { if (!c.baseUrl || !c.apiKey) throw fail("Save the base URL and API key first."); return http(`${String(c.baseUrl).replace(/\/+$/, "")}${path}`, { headers: { "x-api-key": c.apiKey }, label: "Zuper" }); },
    async test(c) { const j = await this._z(c, "/service/notifications/webhook"); return `Connected. ${(j.data || []).length} webhook(s) visible.`; },
    async sync(c) { const items = [], report = [];
      try { const j = await this._z(c, "/service/notifications/webhook"); const list = j.data || [];
        list.forEach(w => items.push({ system: "zuper", container: "Webhooks", kind: "webhook event", name: Importer.slug(w.webhook_name || w.name || w.webhook_uid || "webhook"), label: w.webhook_name || w.name || "", parent: w.module || w.module_name || "", description: `Event ${w.event || w.webhook_event || "?"} → ${w.url || w.webhook_url || w.request_url || "?"}. ${w.is_active === false || w.status === "INACTIVE" ? "INACTIVE. " : ""}Synced from Zuper.` }));
        report.push({ part: "Webhooks", ok: true, count: list.length }); } catch (e) { report.push({ part: "Webhooks", ok: false, error: e.message }); }
      return { items, report }; }
  },
  {
    id: "respond", name: "respond.io", systems: ["respond"],
    intro: "Contact custom fields in the respond.io workspace (name, type, allowed values).",
    fields: [{ key: "token", label: "API access token", secret: true, help: "respond.io: Settings → Integrations → Developer API → Add access token. Store it here only." }],
    async _r(c, url) { if (!c.token) throw fail("Save the access token first."); return http(url, { headers: { Authorization: `Bearer ${c.token}` }, label: "respond.io" }); },
    async test(c) { const j = await this._r(c, "https://api.respond.io/v2/space/custom_field?limit=1"); return `Connected. Custom fields are readable${j.items ? "" : " (empty response)"}.`; },
    async sync(c) { const items = [], report = []; let url = "https://api.respond.io/v2/space/custom_field?limit=100", n = 0, guard = 0;
      try { while (url && guard++ < 20) { const j = await this._r(c, url); (j.items || []).forEach(f => { n++; items.push({ system: "respond", container: "Contact fields", kind: "contact field", name: Importer.slug(f.name), label: f.name, parent: "", description: `Type ${f.dataType || "?"}${f.allowedValues?.length ? `, values: ${f.allowedValues.slice(0, 8).join(", ")}${f.allowedValues.length > 8 ? "…" : ""}` : ""}. ${f.description || ""} Synced from respond.io.`.trim() }); }); url = j.pagination?.next || null; }
        report.push({ part: "Contact fields", ok: true, count: n }); } catch (e) { report.push({ part: "Contact fields", ok: false, error: e.message }); }
      return { items, report }; }
  },
  {
    id: "amplitude", name: "Amplitude", systems: ["amplitude"],
    intro: "The tracking plan: event types, event properties and user properties from the Taxonomy API.",
    fields: [
      { key: "apiKey", label: "Project API key", help: "Amplitude: Settings → Projects → your project → General." },
      { key: "secretKey", label: "Project secret key", secret: true },
      { key: "region", optional: true, label: "Data centre", placeholder: "US", help: "US or EU." }
    ],
    _a(c, path) { if (!c.apiKey || !c.secretKey) throw fail("Save the API key and secret key first."); const base = /eu/i.test(c.region || "") ? "https://analytics.eu.amplitude.com" : "https://amplitude.com"; return http(base + path, { headers: { Authorization: "Basic " + Buffer.from(`${c.apiKey}:${c.secretKey}`).toString("base64") }, label: "Amplitude" }); },
    async test(c) { const j = await this._a(c, "/api/2/taxonomy/event"); return `Connected. ${(j.data || []).length} event types in the tracking plan.`; },
    async sync(c) { const items = [], report = [];
      const part = async (label, path, fn) => { try { const j = await this._a(c, path); (j.data || []).forEach(fn); report.push({ part: label, ok: true, count: (j.data || []).length }); } catch (e) { report.push({ part: label, ok: false, error: e.message }); } };
      await part("Event types", "/api/2/taxonomy/event", e => items.push({ system: "amplitude", container: "Tracking plan", kind: "event", name: e.event_type, label: e.display_name || "", parent: e.category?.name || "", description: `${e.description || ""} ${e.is_active === false ? "(inactive)" : ""} Synced from Amplitude.`.trim() }));
      await part("Event properties", "/api/2/taxonomy/event-property", p => items.push({ system: "amplitude", container: "Tracking plan", kind: "event property", name: p.event_property, label: "", parent: p.event_type || "All events", description: `Type ${p.type || "?"}. ${p.description || ""} Synced from Amplitude.`.trim() }));
      await part("User properties", "/api/2/taxonomy/user-property", p => items.push({ system: "amplitude", container: "Tracking plan", kind: "user property", name: p.user_property, label: "", parent: "User properties", description: `Type ${p.type || "?"}. ${p.description || ""} Synced from Amplitude.`.trim() }));
      return { items, report }; }
  },
  {
    id: "tiktok", name: "TikTok (pixels and events)", systems: ["tiktok"],
    intro: "Pixels in each advertiser account and the events configured on them.",
    fields: [
      { key: "token", label: "Access token", secret: true, help: "TikTok for Business developer portal: create an app owned by Wetility's Business Center, authorise the ad account, and copy the long-term access token." },
      { key: "advertiserIds", label: "Advertiser IDs", placeholder: "7123456789012345678", help: "Ads Manager → account ID. Separate several with commas." }
    ],
    _t(c, path) { if (!c.token) throw fail("Save the access token first."); return http(`https://business-api.tiktok.com/open_api/v1.3${path}`, { headers: { "Access-Token": c.token }, label: "TikTok" }); },
    async test(c) { const advs = ids(c.advertiserIds); if (!advs.length) throw fail("Add at least one advertiser ID."); const j = await this._t(c, `/advertiser/info/?advertiser_ids=${encodeURIComponent(JSON.stringify(advs))}`); if (j.code && j.code !== 0) throw fail(`TikTok: ${j.message}`); return `Connected. ${(j.data?.list || []).map(a => a.name).join(", ") || "advertiser found"}.`; },
    async sync(c) { const items = [], report = [];
      for (const adv of ids(c.advertiserIds)) {
        try { const j = await this._t(c, `/pixel/list/?advertiser_id=${encodeURIComponent(adv)}&page_size=20`); if (j.code && j.code !== 0) throw fail(`TikTok: ${j.message}`);
          const pixels = j.data?.pixels || []; let n = 0;
          pixels.forEach(p => { n++; items.push({ system: "tiktok", container: `Advertiser ${adv}`, kind: "integration", name: String(p.pixel_code || p.pixel_id), label: p.pixel_name || "", parent: "Pixels", description: `Pixel ${p.pixel_id || ""}. ${p.activity_status || ""} Synced from TikTok.`.trim() });
            (p.events || []).forEach(e => { n++; items.push({ system: "tiktok", container: `Advertiser ${adv}`, kind: "standard event", name: e.event_type || e.name || e.external_action || "event", label: e.name && e.name !== e.event_type ? e.name : "", parent: `Pixel ${p.pixel_name || p.pixel_code}`, description: `${e.statistic_type ? "Counting " + e.statistic_type + ". " : ""}Synced from TikTok.` }); }); });
          report.push({ part: `Advertiser ${adv}`, ok: true, count: n });
        } catch (e) { report.push({ part: `Advertiser ${adv}`, ok: false, error: e.message }); }
      }
      return { items, report }; }
  },
  {
    id: "gads", name: "Google Ads", systems: ["gads"],
    intro: "Conversion actions (name, type, status, category, primary or secondary) for each account.",
    fields: [
      { key: "developerToken", label: "Developer token", secret: true, help: "Google Ads manager account → Tools → API Center. Must be on a Wetility-owned manager account." },
      { key: "clientId", label: "OAuth client ID", help: "Google Cloud → APIs & Services → Credentials → OAuth client (Desktop or Web)." },
      { key: "clientSecret", label: "OAuth client secret", secret: true },
      { key: "refreshToken", label: "OAuth refresh token", secret: true, help: "Generated once by a Wetility admin with access to the account (for example with Google's OAuth Playground, scope https://www.googleapis.com/auth/adwords)." },
      { key: "loginCustomerId", optional: true, label: "Manager account ID (login-customer-id)", placeholder: "123-456-7890" },
      { key: "customerIds", label: "Ad account IDs", placeholder: "123-456-7890", help: "Separate several with commas." },
      { key: "version", optional: true, label: "API version", placeholder: "v24", help: "Leave as v24 unless Google retires it." }
    ],
    async _search(c, cid, query) { for (const k of ["developerToken", "clientId", "clientSecret", "refreshToken"]) if (!c[k]) throw fail("Save the developer token and OAuth details first.");
      const token = await googleTokenFromRefresh(c); const h = { Authorization: `Bearer ${token}`, "developer-token": c.developerToken }; if (c.loginCustomerId) h["login-customer-id"] = digits(c.loginCustomerId);
      return http(`https://googleads.googleapis.com/${c.version || "v24"}/customers/${digits(cid)}/googleAds:search`, { method: "POST", headers: h, body: { query }, label: "Google Ads" }); },
    async test(c) { const cid = ids(c.customerIds)[0]; if (!cid) throw fail("Add an ad account ID."); const j = await this._search(c, cid, "SELECT customer.descriptive_name, customer.id FROM customer LIMIT 1"); return `Connected to ${j.results?.[0]?.customer?.descriptiveName || digits(cid)}.`; },
    async sync(c) { const items = [], report = [];
      for (const cid of ids(c.customerIds)) {
        try { const j = await this._search(c, cid, "SELECT conversion_action.name, conversion_action.type, conversion_action.status, conversion_action.category, conversion_action.primary_for_goal, conversion_action.origin FROM conversion_action");
          const rows = j.results || [];
          rows.forEach(r => { const a = r.conversionAction || {}; items.push({ system: "gads", container: `Account ${digits(cid)}`, kind: "conversion action", name: Importer.slug(a.name), label: a.name, parent: a.primaryForGoal ? "Primary" : "Secondary", description: `${a.type || ""} ${a.category || ""} ${a.origin || ""} ${a.status || ""}. Synced from Google Ads.`.replace(/\s+/g, " ").trim() }); });
          report.push({ part: `Account ${digits(cid)}`, ok: true, count: rows.length });
        } catch (e) { report.push({ part: `Account ${digits(cid)}`, ok: false, error: e.message }); }
      }
      return { items, report }; }
  }
];
const BY_ID = Object.fromEntries(CONNECTORS.map(c => [c.id, c]));

// ---------- storage ----------
async function load(id) {
  const r = await q("SELECT value FROM settings WHERE key=$1", ["conn:" + id]);
  if (r.rowCount) return JSON.parse(r.rows[0].value);
  if (id === "freshsales") { // migrate the first version of the Freshsales setting
    const o = await q("SELECT value FROM settings WHERE key='freshsales'");
    if (o.rowCount) { const v = JSON.parse(o.rows[0].value); return { values: { domain: v.domain }, secrets: v.key_enc ? { apiKey: { enc: v.key_enc, last4: v.last4 } } : {}, lastTest: v.lastTest || null, lastSync: v.lastSync || null }; }
  }
  return { values: {}, secrets: {}, lastTest: null, lastSync: null };
}
async function save(id, v, uid) {
  await q(`INSERT INTO settings (key,value,updated_by,updated_at) VALUES ($1,$2,$3,now()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_by=$3, updated_at=now()`, ["conn:" + id, JSON.stringify(v), uid]);
}
function creds(def, st) {
  const c = { ...st.values };
  for (const [k, s] of Object.entries(st.secrets || {})) { try { c[k] = dec(s.enc); } catch (e) { throw fail(`The saved ${k} can no longer be read. Enter it again.`); } }
  return c;
}
function view(def, st) {
  const missing = def.fields.filter(f => !f.optional && !(f.secret ? st.secrets?.[f.key] : st.values?.[f.key])).map(f => f.label);
  const configured = !missing.length;
  return { id: def.id, name: def.name, systems: def.systems, intro: def.intro,
    fields: def.fields.map(f => ({ key: f.key, label: f.label, secret: !!f.secret, placeholder: f.placeholder || "", help: f.help || "", type: f.type || "", value: f.secret ? "" : (st.values?.[f.key] || f.default || ""), saved: f.secret ? !!st.secrets?.[f.key] : undefined, last4: f.secret && st.secrets?.[f.key] ? st.secrets[f.key].last4 : "" })),
    configured, missing, lastTest: st.lastTest, lastSync: st.lastSync };
}

// ---------- merge into registry ----------
async function merge(items, issues, uid, connId, report) {
  const fieldDefs = (await q("SELECT id,name,aliases,status FROM fields")).rows;
  const client = await pool.connect(); let created = 0, updated = 0, logged = 0; const seen = new Set();
  try {
    await client.query("BEGIN");
    for (const it of items) {
      if (!it.name) continue;
      const sug = Importer.suggest({ name: it.name, label: it.label }, fieldDefs);
      const ex = await client.query(`SELECT id FROM impls WHERE system=$1 AND container=$2 AND (lower(name)=lower($3) OR ($4<>'' AND lower(trim(label))=lower(trim($4)))) AND ($1<>'gtm' OR kind=$5)
        ORDER BY (lower(name)=lower($3)) DESC LIMIT 1`, [it.system, it.container, it.name, it.label || "", it.kind]);
      if (ex.rowCount) {
        await client.query(`UPDATE impls SET name=$1, label=CASE WHEN $2='' THEN label ELSE $2 END, kind=$3, parent=CASE WHEN $4='' THEN parent ELSE $4 END, field_id=COALESCE(field_id,$5),
          std=TRUE, state=CASE WHEN state IN ('deprecated','planned') THEN 'live' ELSE state END,
          description=CASE WHEN description ILIKE '%synced from%' OR description='' OR description LIKE 'Freshsales Deals layout%' OR description LIKE 'Found in Freshsales%' THEN $6 ELSE description END,
          by_user=$7, at=now() WHERE id=$8`, [it.name, it.label || "", it.kind, it.parent || "", sug?.id || null, it.description || "", uid, ex.rows[0].id]);
        seen.add(ex.rows[0].id); updated++;
      } else {
        const r = await client.query(`INSERT INTO impls (field_id,system,container,kind,name,label,parent,std,state,description,by_user) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,'live',$8,$9) RETURNING id`,
          [sug?.id || null, it.system, it.container, it.kind, it.name, it.label || "", it.parent || "", it.description || "", uid]);
        seen.add(r.rows[0].id); created++;
      }
    }
    for (const [sec, ref, severity, title, detail] of issues || []) {
      const ex = await client.query("SELECT 1 FROM issues WHERE title=$1", [title]);
      if (!ex.rowCount) { await client.query("INSERT INTO issues (sec,ref,title,detail,severity,by_user) VALUES ($1,$2,$3,$4,$5,$6)", [sec, ref, title, detail, severity, uid]); logged++; }
    }
    await client.query(`INSERT INTO audit (by_user,entity,entity_id,action,detail) VALUES ($1,'import',$2,'synced from API',$3)`, [uid, connId, JSON.stringify({ created, updated, logged, report })]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  // Only compare like with like: a sync of lifecycle stages says nothing about lifecycle statuses or stage rules.
  const pairs = [...new Set(items.map(i => [i.system, i.container, i.kind].join("\u0000")))].map(s => s.split("\u0000"));
  let stale = [];
  for (const [system, container, kind] of pairs) {
    const r = await q(`SELECT id,system,container,name,label FROM impls WHERE system=$1 AND container=$2 AND kind=$3 AND state<>'deprecated' AND NOT (id = ANY($4))`, [system, container, kind, [...seen]]);
    stale = stale.concat(r.rows);
  }
  return { created, updated, logged, stale };
}

// ---------- routes ----------
function routes(app, { auth, isAdmin, wrap, bad }) {
  app.get("/api/connections", auth, isAdmin, wrap(async (req, res) => {
    const out = []; for (const d of CONNECTORS) out.push(view(d, await load(d.id))); res.json(out);
  }));
  app.post("/api/connections/:id", auth, isAdmin, wrap(async (req, res) => {
    const def = BY_ID[req.params.id]; if (!def) return bad(res, "Unknown connection.", 404);
    const st = await load(def.id); const changed = [];
    for (const f of def.fields) {
      const raw = req.body[f.key]; if (raw == null) continue;
      const v = String(raw).trim().slice(0, f.type === "textarea" ? 20000 : 2000);
      if (f.secret) { if (v) { st.secrets[f.key] = { enc: enc(v), last4: f.type === "textarea" ? "" : v.slice(-4) }; changed.push(f.key); } }
      else { st.values[f.key] = v; }
    }
    st.savedAt = new Date().toISOString();
    await save(def.id, st, req.user.id);
    await q("INSERT INTO audit (by_user,entity,entity_id,action,detail) VALUES ($1,'settings',$2,'connection saved',$3)", [req.user.id, def.id, JSON.stringify({ secretsChanged: changed })]);
    res.json(view(def, st));
  }));
  app.delete("/api/connections/:id", auth, isAdmin, wrap(async (req, res) => {
    const def = BY_ID[req.params.id]; if (!def) return bad(res, "Unknown connection.", 404);
    const st = await load(def.id); st.secrets = {}; st.lastTest = null; await save(def.id, st, req.user.id);
    await q("INSERT INTO audit (by_user,entity,entity_id,action) VALUES ($1,'settings',$2,'credentials removed')", [req.user.id, def.id]);
    res.json(view(def, st));
  }));
  app.post("/api/connections/:id/test", auth, isAdmin, wrap(async (req, res) => {
    const def = BY_ID[req.params.id]; if (!def) return bad(res, "Unknown connection.", 404);
    const st = await load(def.id);
    try { st.lastTest = { at: new Date().toISOString(), ok: true, message: await def.test(creds(def, st)) }; }
    catch (e) { st.lastTest = { at: new Date().toISOString(), ok: false, message: e.message }; }
    await save(def.id, st, req.user.id); res.json(view(def, st));
  }));
  app.post("/api/connections/:id/sync", auth, isAdmin, wrap(async (req, res) => {
    const def = BY_ID[req.params.id]; if (!def) return bad(res, "Unknown connection.", 404);
    const st = await load(def.id);
    let out; try { out = await def.sync(creds(def, st)); } catch (e) { return bad(res, e.message, e.status || 500); }
    const m = await merge(out.items, out.issues, req.user.id, def.id, out.report);
    st.lastSync = { at: new Date().toISOString(), created: m.created, updated: m.updated, logged: m.logged, failed: out.report.filter(r => !r.ok).map(r => `${r.part}: ${r.error}`) };
    await save(def.id, st, req.user.id);
    console.log("SYNC", def.id, JSON.stringify({ created: m.created, updated: m.updated, logged: m.logged, stale: m.stale.length, report: out.report }));
    res.json({ ...m, report: out.report, connection: view(def, st) });
  }));
}
module.exports = { routes, CONNECTORS, __merge: merge };
