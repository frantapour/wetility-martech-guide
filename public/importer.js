/* Parsers that turn an export or a copied screen into registry items, and suggest the canonical field for each. */
(function (root) {
"use strict";
const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const slug = s => String(s || "").toLowerCase().replace(/^q:\s*/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);

// Labels that commonly mean a canonical field. Keys are normalised (lowercase, letters and digits only).
const SYNONYMS = {
  googleclickid: "gclid", gclid: "gclid", facebookclickid: "fbc", fbclid: "fbc", fbc: "fbc", tiktokclickid: "ttclid", ttclid: "ttclid", ctwaclid: "ctwa_clid",
  mobile: "phone_e164", mobilenumber: "phone_e164", phone: "phone_e164", phonenumber: "phone_e164", emails: "email", email: "email", emailaddress: "email",
  contractid: "contract_id", contractnumber: "contract_id", creditscore: "credit_score", creditscoregroup: "credit_score_group", sqlcredit: "credit_qualified",
  dealapproved: "credit_approved", contractsigned: "contract_signed", contractsent: "contract_sent",
  utmsource: "utm_source", utmmedium: "utm_medium", utmcampaign: "utm_campaign", utmcontent: "utm_content",
  firsttouchutmsource: "utm_source_first", originalutmsource: "utm_source_first", originalutmmedium: "utm_medium_first", originalutmcampaign: "utm_campaign_first",
  source: "lead_source", firsttouchsource: "lead_source_first", recentsource: "lead_source_latest",
  metaleadid: "meta_lead_id", leadgenid: "meta_lead_id", tiktokleadid: "tiktok_lead_id", freshsalescontactuid: "freshsales_contact_id", versofyuid: "versofy_uid",
  salesintentlevelscore: "intent_score", intentscore: "intent_score", idnumber: "sa_id_number", saidnumber: "sa_id_number", bankaccount: "bank_account",
  creditcheckconsent: "credit_check_consent", lifecyclestage: "lifecycle_stage", status: "lead_status", lostreason: "lost_reason",
  referrercode: "referrer_code", meternumber: "meter_number", onebillmeternumber: "meter_number", productsdropdown: "product_interest",
  firstseenonchat: "chat_started", generatelead: "lead_submitted", leadsubmitted: "lead_submitted", lead: "lead_submitted", submitform: "lead_submitted",
  firstopen: "app_install", install: "app_install", appopen: "app_open", open: "app_open", eventid: "event_id", leadid: "lead_id", insertid: "event_id",
  clientid: "ga_client_id", appinstanceid: "app_instance_id", referringlink: "branch_referring_link", conversationid: "conversation_id", zuperjobid: "zuper_job_id"
};

function suggest(item, fields) {
  const keys = [item.name, item.label].map(norm).filter(Boolean);
  const live = fields.filter(f => f.status !== "deprecated");
  for (const k of keys) {
    const exact = live.find(f => norm(f.name) === k || (f.aliases || []).some(a => norm(a) === k));
    if (exact) return { id: exact.id, why: "name match" };
  }
  for (const k of keys) {
    const s = SYNONYMS[k];
    if (s && live.some(f => f.id === s)) return { id: s, why: "common label" };
  }
  return null;
}

// Copied field-layout screens (Freshsales, Zuper, respond.io contact fields) or any plain list.
const NOISE = /^(add field|add group|preview|rename module|manage field dependencies|click to add fields here|learn more|\d+ - \d+ of \d+)$/i;
function parseList(text, opts = {}) {
  const raw = String(text || "").split(/\r?\n/).map(l => l.replace(/\t/g, " ").trim());
  const lines = raw.filter(l => l && !/^add contacts faster/i.test(l));
  let container = opts.container || "", section = "", group = "";
  const items = [], next = i => lines[i + 1] || "", next2 = i => lines[i + 2] || "";
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (NOISE.test(l)) continue;
    if (/^rename module$/i.test(next(i))) { if (!container) container = l; continue; }
    if (/^add field$/i.test(next(i))) {
      if (/^add group$/i.test(next2(i))) { section = l; group = ""; } else group = l;
      continue;
    }
    const label = l.replace(/\s+/g, " ");
    items.push({ name: opts.labelsAreNames ? label : slug(label) || label, label, parent: [section, group].filter(Boolean).join(" / ") });
  }
  return { container, items };
}

// CSV with a header row. Recognised columns: name, label, type/kind, parent/group, description, container.
function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter(r => r.some(x => x.trim()));
  if (clean.length < 2) return { container: "", items: [] };
  const head = clean[0].map(h => norm(h));
  const col = (...names) => head.findIndex(h => names.includes(h));
  const ci = { name: col("name", "apiname", "eventname", "key", "fieldname", "internalname"), label: col("label", "displayname", "fieldlabel", "title"), kind: col("type", "kind", "itemtype"), parent: col("parent", "group", "section", "folder"), desc: col("description", "notes", "whatitmeasures"), container: col("container", "module", "property", "account") };
  if (ci.name < 0 && ci.label < 0) ci.name = 0;
  let container = "";
  const items = clean.slice(1).map(r => {
    const g = i => (i >= 0 ? String(r[i] || "").trim() : "");
    if (!container && g(ci.container)) container = g(ci.container);
    const label = g(ci.label), name = g(ci.name) || slug(label);
    return { name, label: label && label !== name ? label : "", kind: g(ci.kind), parent: g(ci.parent), description: g(ci.desc) };
  }).filter(x => x.name);
  return { container, items };
}

// Google Tag Manager: Admin > Export container (JSON).
function parseGTM(text) {
  let j; try { j = JSON.parse(text); } catch (e) { throw new Error("That is not valid JSON. In GTM use Admin > Export container and paste or upload the file."); }
  const cv = j.containerVersion || j;
  const container = cv.container?.publicId || cv.container?.name || "";
  const p = (arr, key) => (arr || []).find(x => x.key === key)?.value;
  const trig = Object.fromEntries((cv.trigger || []).map(t => [t.triggerId, t]));
  const items = [];
  (cv.trigger || []).forEach(t => {
    const ce = (t.customEventFilter || [])[0]; const ev = ce ? p(ce.parameter, "arg1") : "";
    items.push({ kind: "trigger", name: ev || slug(t.name), label: t.name, parent: t.type || "", description: ev ? `Custom event trigger for ${ev}` : `Trigger type ${t.type}` });
  });
  (cv.tag || []).forEach(t => {
    const ev = p(t.parameter, "eventName") || p(t.parameter, "conversionLabel") || "";
    const fires = (t.firingTriggerId || []).map(id => trig[id]?.name || (id === "2147479553" ? "All Pages" : id)).join(", ");
    items.push({ kind: "tag", name: ev || slug(t.name), label: t.name, parent: fires, description: `Tag type ${t.type}${t.paused ? " (paused)" : ""}` });
  });
  (cv.variable || []).forEach(v => {
    const key = v.type === "v" ? p(v.parameter, "name") : "";
    items.push({ kind: "variable", name: key || slug(v.name), label: v.name, parent: "", description: v.type === "v" ? `Data layer variable reading ${key}` : `Variable type ${v.type}` });
  });
  return { container, items };
}

const api = { norm, slug, suggest, parseList, parseCSV, parseGTM, SYNONYMS };
if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Importer = api;
})(typeof window !== "undefined" ? window : globalThis);
