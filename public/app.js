/* Wetility MarTech guide - front end. Content comes from content.js; everything people record lives in the API. */
(() => {
"use strict";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const fmtD = v => v ? new Date(v).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "";
const fmtDT = v => v ? new Date(v).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
const lines = s => String(s || "").split("\n").map(x => x.trim()).filter(Boolean);
function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 2600); }
async function api(method, url, body) {
  const r = await fetch(url, { method, credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Requested-With": "mt" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || "Request failed."); e.status = r.status; throw e; }
  return j;
}
function lev(a, b) { const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9; const d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }

const SYS = Object.fromEntries(SYSTEMS.map(s => [s.id, s]));
const sysName = id => SYS[id]?.short || ({ governance: "Governance and privacy", native: "Native integrations" }[id] || id);
const STEP_OPTS = [["todo", "Not started"], ["progress", "In progress"], ["done", "Done"], ["blocked", "Blocked"]];
const TEST_OPTS = [["todo", "Not run"], ["pass", "Pass"], ["fail", "Fail"]];
const GATE_OPTS = [["todo", "Pending"], ["progress", "In review"], ["approved", "Approved"], ["blocked", "Blocked"]];
const CHECK_OPTS = [["todo", "Open"], ["done", "Done"]];
const CODE_LABEL = { consistent: "Consistent", platform: "Fixed name (platform-required or cannot be renamed)", differs: "Name differs", old: "Uses an old name", pending: "Rename pending", unconfirmed: "Name to confirm", unmapped: "Not mapped", deprecated: "Deprecated" };

let S = { me: null, data: null, A: null, q: "", flag: null, users: null, tempPw: null };
let filterMe = null; try { filterMe = localStorage.getItem("mt_me"); } catch (e) {}
const canWrite = () => S.me && ["admin", "editor"].includes(S.me.role) && !S.me.must_change;
const isAdmin = () => S.me?.role === "admin";
const names = () => Object.fromEntries((S.data?.users || []).map(u => [u.id, u.name]));
const nameOf = id => (id && names()[id]) || "Someone";
const st = k => S.statusMap?.[k]?.state || "todo";

// ---------- data ----------
async function load() {
  S.data = await api("GET", "/api/state");
  S.me = S.data.me;
  S.statusMap = Object.fromEntries(S.data.statuses.map(s => [s.key, s]));
  S.A = analyze();
}
function analyze() {
  const F = S.data.fields, I = S.data.impls;
  const fieldOf = id => F.find(f => f.id === id);
  const active = F.filter(f => f.status !== "deprecated");
  const byField = {}; I.forEach(i => { (byField[i.field_id || ""] ??= []).push(i); });
  const code = {};
  I.forEach(i => {
    const f = fieldOf(i.field_id); let c;
    if (i.state === "deprecated") c = "deprecated";
    else if (!f) c = "unmapped";
    else if (/^\[/.test(i.name)) c = "unconfirmed";
    else if (i.state === "rename-pending") c = "pending";
    else if (i.std) c = "platform";
    else if (norm(i.name) === norm(f.name)) c = "consistent";
    else if ((f.aliases || []).some(a => norm(a) === norm(i.name))) c = "old";
    else c = "differs";
    code[i.id] = c;
  });
  const live = i => i.state !== "deprecated";
  const privacy = I.filter(i => { const f = fieldOf(i.field_id); return f && live(i) && ((f.pii === "sensitive" && NO_SENSITIVE.includes(i.system)) || (f.pii === "personal" && NO_PERSONAL.includes(i.system))); });
  const g = {}; I.filter(i => live(i) && i.field_id && !/^\[/.test(i.name)).forEach(i => { (g[[i.field_id, i.system, i.kind, norm(i.name)].join("|")] ??= []).push(i); });
  const g3 = {}; I.filter(i => live(i) && i.field_id && !(i.system === "gtm" && i.kind === "tag") && !/^\[/.test(i.name)).forEach(i => { (g3[[i.field_id, i.system, i.kind].join("|")] ??= []).push(i); });
  const sameName = Object.values(g).filter(a => a.length > 1), sameKey = new Set(sameName.flat().map(i => i.id));
  const dups = [...sameName, ...Object.values(g3).filter(a => a.length > 1 && a.some(i => !sameKey.has(i.id)))];
  const g2 = {}; I.filter(i => live(i) && i.field_id && !i.std && !/^\[/.test(i.name)).forEach(i => { (g2[i.system + "|" + norm(i.name)] ??= []).push(i); });
  const collisions = Object.values(g2).filter(a => new Set(a.map(x => x.field_id)).size > 1);
  const missing = []; active.forEach(f => (f.expected || []).forEach(sys => { if (!(byField[f.id] || []).some(i => i.system === sys && live(i))) missing.push([f, sys]); }));
  const similar = [];
  for (let a = 0; a < active.length; a++) for (let b = a + 1; b < active.length; b++) {
    const x = active[a], y = active[b], nx = norm(x.name), ny = norm(y.name), ax = (x.aliases || []).map(norm), ay = (y.aliases || []).map(norm);
    if (nx === ny || ax.includes(ny) || ay.includes(nx) || ax.some(v => v && ay.includes(v)) || (nx.length >= 6 && ny.length >= 6 && lev(nx, ny) <= 2)) similar.push([x, y]);
  }
  const by = c => I.filter(i => code[i.id] === c);
  const mapped = I.filter(i => ["consistent", "platform", "differs", "old", "pending"].includes(code[i.id]));
  const good = mapped.filter(i => ["consistent", "platform"].includes(code[i.id])).length;
  const privIds = new Set(privacy.map(i => i.id)), dupIds = new Set(dups.flat().map(i => i.id));
  return { code, privacy, dups, collisions, missing, similar, unmapped: by("unmapped"), naming: [...by("differs"), ...by("old")], pending: by("pending"), unconfirmed: by("unconfirmed"),
    score: mapped.length ? Math.round(good / mapped.length * 100) : null, byField, fieldOf, privIds, dupIds,
    problems: privacy.length + dups.length + collisions.length + similar.length + by("differs").length + by("old").length + by("unmapped").length };
}

// ---------- small renderers ----------
const OPT_ICON = { todo: "circle", progress: "play", done: "check", blocked: "x", pass: "check", fail: "x", approved: "check" };
function sel(key, opts) {
  const v = st(key), r = S.statusMap[key], dis = canWrite() ? "" : "disabled";
  return `<div class="stctl"><div class="seg" role="group" aria-label="Status">${opts.map(([k, l]) => `<button type="button" data-act="set-state" data-key="${key}" data-v="${k}" class="${k === v ? "on" : ""}" aria-pressed="${k === v}" ${dis}>${icon(OPT_ICON[k] || "circle", "sm")}${l}</button>`).join("")}</div>${r ? `<div class="stmeta">${esc(nameOf(r.by_user))} · ${fmtD(r.at)}</div>` : ""}</div>`;
}
const pbProgress = p => { let d = 0, b = 0, g = 0; p.steps.forEach((_, i) => { const v = st(`${p.id}-s${i + 1}`); if (v === "done") d++; else if (v === "blocked") b++; else if (v === "progress") g++; }); return { d, b, g, n: p.steps.length }; };
const bar = pr => { const w = x => (x / pr.n * 100).toFixed(1) + "%"; return `<div class="bar" role="img" aria-label="${pr.d} of ${pr.n} done"><i class="d" style="width:${w(pr.d)}"></i><i class="p" style="width:${w(pr.g)}"></i><i class="b" style="width:${w(pr.b)}"></i></div>`; };
const isMine = txt => filterMe && txt.includes(filterMe);
const delBtn = (act, id) => `<button class="btn" style="padding:1px 8px;font-size:12px;margin-left:auto" data-act="${act}" data-id="${id}">Delete</button>`;
const ro = () => canWrite() ? "" : `<p class="muted" style="font-size:13px">You have view-only access.</p>`;
const chip = (i) => { const A = S.A; let c = A.code[i.id]; if (A.privIds.has(i.id)) c = "privacy"; else if (A.dupIds.has(i.id)) c = "dup";
  const cls = { consistent: "c-consistent", platform: "c-platform", differs: "c-differs", old: "c-old", pending: "c-pending", unconfirmed: "c-unconfirmed", privacy: "c-privacy", dup: "c-dup", unmapped: "c-unconfirmed", deprecated: "c-unconfirmed" }[c];
  const title = c === "privacy" ? "Privacy conflict: this data must not be here" : c === "dup" ? "Duplicate: implemented more than once" : CODE_LABEL[c];
  return `<span class="cell ${cls}" title="${esc(title)}">${esc(i.name)}</span>`; };
function kbBadge(k) {
  if (k.review_flag) return `<span class="pill bad kbbadge">Flagged for review</span>`;
  if (!k.verified_on) return `<span class="pill warn kbbadge">Not yet verified</span>`;
  const days = (Date.now() - new Date(k.verified_on)) / 864e5;
  return days > 90 ? `<span class="pill warn kbbadge">Review due · verified ${fmtD(k.verified_on)}</span>` : `<span class="pill ok kbbadge">Verified ${fmtD(k.verified_on)}</span>`;
}

// ---------- shared blocks ----------
function commentsBlock(sec) {
  const list = S.data.comments.filter(c => c.sec === sec);
  return `<h2>Comments <span class="muted" style="font:400 14px var(--f-body)">${list.length || ""}</span></h2>
  <div class="feed">${list.length ? list.map(c => `<div class="entry"><div class="h"><b>${esc(nameOf(c.by_user))}</b><span>${fmtD(c.at)}</span>${c.by_user === S.me.id || isAdmin() ? delBtn("del-comments", c.id) : ""}</div><p>${esc(c.text)}</p></div>`).join("") : `<div class="empty">No comments yet. Questions, objections and decisions about this section go here.</div>`}</div>
  ${canWrite() ? `<form class="f" data-form="comment" data-sec="${sec}"><label for="ct-${sec}">Add a comment<textarea id="ct-${sec}" name="text" required maxlength="4000"></textarea></label><div class="acts"><button class="btn primary" type="submit">Post comment</button></div></form>` : ""}`;
}
function entryHTML(l) {
  const pb = PB.find(p => p.id === l.sec);
  return `<div class="entry"><div class="h"><b>${esc(l.ref || "")}</b><span>${pb ? `<a href="#${pb.id}">${pb.no}</a> · ` : ""}${esc(nameOf(l.by_user))} · ${l.date ? fmtD(l.date) : fmtD(l.at)}</span>${l.by_user === S.me.id || isAdmin() ? delBtn("del-logs", l.id) : ""}</div><p>${esc(l.text)}</p>${l.evidence ? `<p><a href="${esc(l.evidence)}" target="_blank" rel="noopener">Evidence</a></p>` : ""}</div>`;
}
function logBlock(sec, refs) {
  const list = S.data.logs.filter(l => l.sec === sec);
  return `<h2>What was implemented</h2>
  <div class="feed">${list.length ? list.map(entryHTML).join("") : `<div class="empty">Nothing recorded yet. Log what was actually built or changed, with a link to the evidence.</div>`}</div>
  ${canWrite() ? `<form class="f" data-form="log" data-sec="${sec}"><div class="two"><label for="lr-${sec}">Step or test<select id="lr-${sec}" name="ref">${refs.map(r => `<option>${esc(r)}</option>`).join("")}</select></label><label for="ld-${sec}">Date implemented<input id="ld-${sec}" name="date" type="date" required></label></div>
  <label for="lt-${sec}">What was implemented<textarea id="lt-${sec}" name="text" required maxlength="4000" placeholder="e.g. New Wetility-owned Meta dataset created; test PageView and Lead seen in Events Manager"></textarea></label>
  <label for="le-${sec}">Evidence link (optional)<input id="le-${sec}" name="evidence" type="url" placeholder="https://"></label>
  <div class="acts"><button class="btn primary" type="submit">Record implementation</button></div></form>` : ""}`;
}
function issueHTML(x) {
  const pb = PB.find(p => p.id === x.sec);
  const where = pb ? `<a href="#${pb.id}">${pb.no}</a>` : x.sec === "registry" ? `<a href="#f-${esc(x.ref)}">Registry</a>` : esc(x.sec);
  return `<div class="entry"><div class="h"><b>${esc(x.title)}</b><span class="pill ${x.state === "open" ? "bad" : "ok"}">${x.state === "open" ? "Open" : "Resolved"}</span><span class="sev-${x.severity}">${esc(x.severity)}</span><span>${where}${x.ref && x.sec !== "registry" ? " · " + esc(x.ref) : ""} · ${esc(nameOf(x.by_user))} · ${fmtD(x.at)}</span></div>
  ${x.detail ? `<p>${esc(x.detail)}</p>` : ""}
  ${x.state === "resolved" ? `<div class="res"><b>What worked</b> <span class="muted" style="font-size:12.5px">${esc(nameOf(x.resolved_by))} · ${fmtD(x.resolved_at)}</span><p>${esc(x.resolution)}</p></div>${canWrite() ? `<div class="acts" style="margin-top:6px"><button class="btn" data-act="reopen" data-id="${x.id}">Reopen</button></div>` : ""}`
    : canWrite() ? `<details style="margin-top:6px"><summary class="btn" style="display:inline-block">Resolve: log what worked</summary><form class="f" data-form="resolve" data-id="${x.id}"><label for="rs-${x.id}">What fixed it (so the next person can repeat it)<textarea id="rs-${x.id}" name="resolution" required maxlength="4000"></textarea></label><div class="acts"><button class="btn primary" type="submit">Mark resolved</button></div></form></details>` : ""}</div>`;
}
function issueBlock(sec, refs, fixedRef) {
  const list = S.data.issues.filter(x => x.sec === sec && (!fixedRef || x.ref === fixedRef));
  const open = list.filter(x => x.state === "open").length;
  return `<h2>Problems and fixes <span class="muted" style="font:400 14px var(--f-body)">${open ? open + " open" : ""}</span></h2>
  <div class="feed">${list.length ? list.map(issueHTML).join("") : `<div class="empty">No problems logged. If something does not work, log it here; when it is fixed, record what worked.</div>`}</div>
  ${canWrite() ? `<details><summary class="btn" style="display:inline-block;margin-top:8px">Log a problem</summary><form class="f" data-form="issue" data-sec="${sec}" ${fixedRef ? `data-ref="${esc(fixedRef)}"` : ""}>
  <label for="it-${sec}">What is not working<input id="it-${sec}" name="title" required maxlength="200" placeholder="e.g. Meta Test Events shows Lead twice"></label>
  <div class="two">${fixedRef ? "" : `<label for="ir-${sec}">Related step<select id="ir-${sec}" name="ref">${refs.map(r => `<option>${esc(r)}</option>`).join("")}</select></label>`}<label for="is-${sec}">Severity<select id="is-${sec}" name="severity"><option value="high">High: blocks the work</option><option value="medium" selected>Medium</option><option value="low">Low</option></select></label></div>
  <label for="id-${sec}">Details (what you tried, error messages)<textarea id="id-${sec}" name="detail" maxlength="4000"></textarea></label>
  <div class="acts"><button class="btn primary" type="submit">Log problem</button></div></form></details>` : ""}`;
}
function kpiCard(k) {
  const hist = S.data.results.filter(r => r.kpi === k.id), last = hist[hist.length - 1], v = last ? Number(last.value) : null;
  const [lab, cls] = v == null ? ["No data", ""] : k.target == null ? ["Baseline", "warn"] : (k.dir === "min" ? v >= k.target : v <= k.target) ? ["On target", "ok"] : ["Off target", "bad"];
  const fmtV = x => x == null ? "–" : k.unit === "R" ? "R" + Number(x).toLocaleString("en-ZA") : k.unit === "%" ? x + "%" : k.unit === "x" ? x + "×" : String(x);
  let spark = "";
  if (hist.length > 1) {
    const vals = hist.map(h => Number(h.value)), lo = Math.min(...vals, k.target ?? Infinity), hi = Math.max(...vals, k.target ?? -Infinity), r = hi - lo || 1, W = 300, H = 44, p = 4;
    const pts = vals.map((x, i) => [p + i * (W - 2 * p) / (vals.length - 1), H - p - (x - lo) / r * (H - 2 * p)]);
    const ty = k.target != null ? H - p - (k.target - lo) / r * (H - 2 * p) : null;
    spark = `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${ty != null ? `<line x1="0" x2="${W}" y1="${ty}" y2="${ty}" stroke="var(--muted)" stroke-dasharray="3 3"/>` : ""}<polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${pts.map(q => q.join(",")).join(" ")}"/><circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="3.5" fill="var(--accent)"/></svg>`;
  }
  return `<div class="kpi"><div class="top"><div><div class="eyebrow">${esc(k.grp)}</div><b>${esc(k.name)}</b></div><span class="pill ${cls}">${lab}</span></div>
  <div class="acts"><span class="val">${fmtV(v)}</span><span class="muted" style="font-size:13px">${last ? esc(last.period) : ""} · target ${esc(k.tl)}</span></div>${spark}
  <div class="muted" style="font-size:13px">${esc(k.def)}</div>
  ${canWrite() ? `<form class="f" data-form="result" data-kpi="${k.id}" style="margin:0"><div class="two"><label for="rv-${k.id}">Value (${esc(k.unit)})<input id="rv-${k.id}" name="value" type="number" step="any" required></label><label for="rp-${k.id}">Period<input id="rp-${k.id}" name="period" required maxlength="40" placeholder="e.g. W45 or Nov 2026"></label></div><label for="rn-${k.id}">Source / note<input id="rn-${k.id}" name="note" maxlength="300" placeholder="e.g. Ivy tracker, BAU Resi tab"></label><div class="acts"><button class="btn" type="submit">Record measurement</button></div></form>` : ""}
  ${hist.length ? `<details><summary class="muted" style="font-size:13px;cursor:pointer">History (${hist.length})</summary><div class="tbl" style="margin-top:6px"><table><tr><th>Period</th><th>Value</th><th>By</th><th>Note</th></tr>${hist.slice().reverse().map(h => `<tr><td>${esc(h.period)}</td><td class="n">${fmtV(Number(h.value))}</td><td>${esc(nameOf(h.by_user))}</td><td>${esc(h.note || "")} ${h.by_user === S.me.id || isAdmin() ? `<button class="btn" style="padding:0 6px;font-size:11px" data-act="del-results" data-id="${h.id}">Delete</button>` : ""}</td></tr>`).join("")}</table></div></details>` : ""}</div>`;
}
function kbPanel(pbId) {
  const arts = S.data.kb.filter(k => (k.pbs || []).includes(pbId));
  if (!arts.length) return "";
  return `<h2>Current vendor guidance</h2><p class="muted">From the knowledge base. Where this differs from the steps above, follow the knowledge base and log an issue to update the step.</p><div class="feed">${arts.map(k => `<div class="entry"><div class="h"><b><a href="#kb-${k.id}">${esc(k.title)}</a></b>${kbBadge(k)}</div><p>${esc(k.summary)}</p>${(k.changes || []).length ? `<ul style="margin:6px 0 0;padding-left:18px">${k.changes.map(c => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}</div>`).join("")}</div>`;
}

// ---------- views: programme ----------
function attentionItems() {
  const A = S.A, openIssues = S.data.issues.filter(x => x.state === "open");
  const blocked = []; PB.forEach(p => p.steps.forEach((s, i) => { if (st(`${p.id}-s${i + 1}`) === "blocked") blocked.push([p, i, s]); }));
  const qaFail = QA.filter(q => st("qa-" + q[0]) === "fail");
  const kOff = KPIS.filter(k => { const h = S.data.results.filter(r => r.kpi === k.id); if (!h.length || k.target == null) return false; const v = Number(h.at(-1).value); return !(k.dir === "min" ? v >= k.target : v <= k.target); });
  return [
    ...(st("gate-G1") !== "approved" ? [`<div class="box bad"><b>Live exposure: 620+ credit signal to ad platforms</b>G1 privacy is not approved yet. Confirm Information Officer sign-off by 7 Nov 2026. <a href="#read">Details</a></div>`] : []),
    ...(A.privacy.length ? [`<div class="box bad"><b>${A.privacy.length} privacy conflict${A.privacy.length > 1 ? "s" : ""} in tracking</b>Sensitive or personal data recorded where it must not be. <a href="#consistency">Review</a></div>`] : []),
    ...openIssues.filter(x => x.severity === "high").map(x => `<div class="box warn"><b>${esc(x.title)}</b>High-severity problem. <a href="#issues">Open</a></div>`),
    ...(A.dups.length ? [`<div class="box warn"><b>${A.dups.length} duplicate${A.dups.length > 1 ? "s" : ""} in tracking</b>Same thing implemented twice in one system. <a href="#consistency">Review</a></div>`] : []),
    ...blocked.map(([p, i, s]) => `<div class="box warn"><b>Blocked: ${p.no} step ${i + 1}</b>${esc(s.slice(0, 120))}${s.length > 120 ? "…" : ""} <a href="#${p.id}">Open</a></div>`),
    ...qaFail.map(q => `<div class="box warn"><b>Test failed: ${q[0]}</b>${esc(q[1])} <a href="#qa">Open</a></div>`),
    ...kOff.map(k => `<div class="box warn"><b>Off target: ${esc(k.name)}</b><a href="#results">Open</a></div>`)];
}
function nextSteps() {
  const out = [];
  PB.filter(p => !filterMe || isMine(p.owner)).forEach(p => {
    const states = p.steps.map((_, i) => st(`${p.id}-s${i + 1}`));
    let i = states.indexOf("progress"); if (i < 0) i = states.indexOf("blocked"); if (i < 0) i = states.indexOf("todo");
    if (i >= 0) out.push({ p, i, v: states[i], pr: pbProgress(p) });
  });
  const rank = { progress: 0, blocked: 1, todo: 2 };
  return out.sort((a, b) => rank[a.v] - rank[b.v] || a.p.ws - b.p.ws);
}
function parseWeeks(w) { const m = String(w).match(/(\d+)\s*[–-]\s*(\d+)/); return m ? [+m[1], +m[2]] : [4, 14]; }
// Executive summary card (Home): curated findings from /api/summary, live counts, Word and Excel downloads.
function execBlock() {
  if (S.summary === undefined) { S.summary = null; api("GET", "/api/summary").then(j => { S.summary = j; if (curKey() === "overview") render(true); }).catch(() => { S.summary = false; }); }
  const sm = S.summary, today = new Date().toISOString().slice(0, 10);
  const aDone = ACTIONS.filter(a => st("act-" + a[0]) === "done").length, aLate = ACTIONS.filter(a => st("act-" + a[0]) !== "done" && a[1] < today).length;
  const gDone = GAPS.filter(g => st("gap-" + g[0]) === "done").length, high = S.data.issues.filter(x => x.state === "open" && x.severity === "high").length;
  return `<section class="card exec" aria-labelledby="exec-h"><div class="exec-top"><h2 id="exec-h" style="margin:0">${icon("target")} Executive summary</h2>
   <div class="acts"><a class="btn primary sm" href="/api/summary.docx" download>Download Word</a><a class="btn sm" href="/api/summary.xlsx" download>Download Excel</a></div></div>
   ${sm ? `<p class="exec-head">${esc(sm.headline)}</p>` : `<p class="muted">${sm === false ? "Could not load the summary." : "Loading the summary..."}</p>`}
   <div class="exec-stats"><a href="#arch"><b>${aDone}/${ACTIONS.length}</b><span>Actions done</span></a><a href="#arch"${aLate ? ' class="late"' : ""}><b>${aLate}</b><span>Actions overdue</span></a><a href="#arch"><b>${gDone}/${GAPS.length}</b><span>Gaps closed</span></a><a href="#issues"><b>${high}</b><span>High problems open</span></a></div>
   ${sm ? `<details class="exec-more" data-open-key="exec" ${S.secOpen?.exec ? "open" : ""}><summary>Key messages, funnel signals, attribution and data points</summary>
    <ul class="exec-msgs">${sm.messages.map(([k, v]) => `<li><b>${esc(k)}:</b> ${esc(v)}</li>`).join("")}</ul>
    <h3 style="margin:14px 0 6px">Funnel signals: what the ad platforms learn from</h3>
    <p class="muted" style="margin:0 0 8px">Today they only hear about the form fill. The target sends every stage back by server.</p>
    <div class="tbl"><table><tr><th>Stage</th><th>Sent today</th><th>Target</th><th>Value</th></tr>${sm.signals.map(r => `<tr><td><b>${esc(r[0])}</b><br><span class="muted">${esc(r[1])}</span></td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td></tr>`).join("")}</table></div>
    <h3 style="margin:14px 0 6px">Attribution: today and target</h3>
    <div class="tbl"><table><tr><th>Channel</th><th>Today</th><th>Target</th></tr>${sm.attribution.map(r => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("")}</table></div>
    <h3 style="margin:14px 0 6px">Key data points</h3>
    <div class="tbl"><table><tr><th>Metric</th><th>Value</th><th>Source</th></tr>${sm.metrics.map(m => `<tr><td>${esc(m[0])}</td><td><b>${esc(typeof m[1] === "number" ? m[1].toLocaleString("en-ZA") : m[1])}</b></td><td class="muted">${esc(m[2])}, ${esc(m[3])}</td></tr>`).join("")}</table></div>
    <p class="muted" style="font-size:12px;margin:8px 0 0">Findings as of ${esc(sm.asOf)}. The downloads add ownership by platform, all actions with owners, gaps and open problems.</p></details>` : ""}
  </section>`;
}
function vOverview() {
  const all = PB.reduce((a, p) => { const r = pbProgress(p); a.d += r.d; a.n += r.n; return a; }, { d: 0, n: 0 });
  const h = new Date().getHours(), greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const openIssues = S.data.issues.filter(x => x.state === "open").length, gatesOk = GATES.filter(g => st("gate-" + g[0]) === "approved").length;
  const ns = nextSteps().slice(0, 5), att = attentionItems();
  const recent = [
    ...S.data.logs.map(l => ({ at: l.at, who: l.by_user, t: `recorded <b>${esc(l.ref || "an implementation")}</b>`, href: "#" + l.sec })),
    ...S.data.issues.map(x => ({ at: x.state === "resolved" ? x.resolved_at : x.at, who: x.state === "resolved" ? x.resolved_by : x.by_user, t: `${x.state === "resolved" ? "resolved" : "logged"} <b>${esc(x.title)}</b>`, href: "#issues" })),
    ...S.data.audit.filter(a => a.entity !== "user").map(a => ({ at: a.at, who: a.by_user, t: `${esc(a.action)} ${esc(a.entity === "impl" ? "a tracking item" : a.entity === "kb" ? "a guidance article" : a.entity)}`, href: a.entity === "kb" ? "#kb-" + a.entity_id : "#consistency" }))]
    .filter(x => x.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 7);
  return `<section class="hero"><div class="eyebrow">${new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}</div>
  <h1>${greet}, ${esc((S.me.name || "").split(" ")[0])}</h1><p>${filterMe ? `Showing ${esc(filterMe)}'s playbooks.` : "The MarTech programme at a glance."} ${all.d} of ${all.n} playbook steps done.</p>
  <div class="stats"><a href="#playbooks"><b>${Math.round(all.d / all.n * 100)}%</b><span>Steps done ›</span></a><a href="#gates"><b>${gatesOk}/7</b><span>Gates approved ›</span></a><a href="#issues"><b>${openIssues}</b><span>Open problems ›</span></a><a href="#consistency"><b>${S.A.score == null ? "–" : S.A.score + "%"}</b><span>Names consistent ›</span></a></div>
  <div class="focus"><label for="iam2" style="font-size:13px;color:#B9C6DA">Focus on</label><select id="iam2" data-focus="1"><option value="">Everyone</option>${PEOPLE.map(n => `<option ${n === filterMe ? "selected" : ""}>${n}</option>`).join("")}</select></div></section>
  <div class="cols"><div>
   ${execBlock()}
   <a class="tile link starthere" href="#arch">${icon("target")}<div class="l"><b>Start here: target architecture</b><br>${GAPS.filter(g => st("gap-" + g[0]) === "done").length} of ${GAPS.length} gaps closed. What to fix, in what order, and why</div>${icon("chev", "sm go")}</a>
   <h2>${icon("check")} Next actions</h2>
   ${actionsBlock(5)}
   <h2>${icon("target")} Playbook steps</h2>
   <div class="next">${ns.length ? ns.map(({ p, i, v, pr }) => `<div class="card nextcard">${ring(pr.d / pr.n * 100, 46)}<a class="t" href="#${p.id}" style="color:inherit;text-decoration:none"><b>${p.no} ${esc(p.title)}</b><div class="s">Step ${i + 1}: ${esc(p.steps[i])}</div>${v !== "todo" ? `<span class="pill ${v === "blocked" ? "bad" : "sun"}" style="margin-top:6px">${v === "blocked" ? "Blocked" : "In progress"}</span>` : ""}</a>
     <div class="acts" style="flex-direction:column;align-items:stretch">${canWrite() ? (v === "todo" ? `<button class="btn sm" data-act="set-state" data-key="${p.id}-s${i + 1}" data-v="progress">${icon("play", "sm")}Start</button>` : `<button class="btn sm primary" data-act="set-state" data-key="${p.id}-s${i + 1}" data-v="done">${icon("check", "sm")}Done</button>`) : ""}<a class="btn sm ghost" href="#${p.id}">Open</a></div></div>`).join("") : `<div class="empty">${icon("check")}Nothing left to do${filterMe ? " in " + esc(filterMe) + "'s playbooks" : ""}.</div>`}</div>
   <h2>${icon("calendar")} Workstream timeline</h2>
   <div class="card timeline"><div class="tl-axis"><div></div><div><span>Week 1</span><span>Week 7</span><span>Week 14</span></div></div>
   ${WS.map(w => { const ps = w[4].map(id => PB.find(p => p.id === id)); const pr = ps.reduce((a, p) => { const r = pbProgress(p); a.d += r.d; a.b += r.b; a.n += r.n; return a; }, { d: 0, b: 0, n: 0 }); const [a, b] = parseWeeks(w[3]);
     return `<div class="tl-row"><a href="#${ps[0].id}" title="${esc(w[1])}">WS${w[0]} ${esc(w[1])}</a><div class="tl-track"><div class="tl-bar${pr.b ? " blocked" : ""}" style="left:${(a - 1) / 14 * 100}%;width:${(b - a + 1) / 14 * 100}%" title="${esc(w[3])}: ${pr.d}/${pr.n} steps done"><i style="width:${pr.d / pr.n * 100}%"></i></div></div></div>`; }).join("")}
   <p class="muted" style="font-size:12px;margin:8px 0 0">Bars show each workstream's indicative window; the fill shows steps done.</p></div>
  </div><div>
   <h2>${icon("alert")} Needs attention</h2>${att.length ? att.slice(0, 6).join("") + (att.length > 6 ? `<p class="muted" style="font-size:13px">${att.length - 6} more on the <a href="#issues">problems</a> and <a href="#consistency">consistency</a> pages.</p>` : "") : `<div class="empty">${icon("check")}Nothing blocked, failed or conflicting.</div>`}
   <h2>${icon("log")} Recent activity</h2><div class="card" style="padding:4px 16px">${recent.length ? recent.map(r => `<div class="act-item"><span class="dot"></span><div><a href="${r.href}" style="color:inherit;text-decoration:none">${esc(nameOf(r.who))} ${r.t}</a><div class="by">${fmtDT(r.at)}</div></div></div>`).join("") : `<p class="muted" style="padding:10px 0">No activity yet.</p>`}</div>
  </div></div>`;
}
function vPlaybooks() {
  return `<div class="eyebrow">Playbooks</div><h1>Implementation playbooks</h1><p class="lede">Thirteen playbooks in eight workstreams. Each has its steps, the current vendor guidance, problems and fixes, and what was implemented.</p>
  <div class="acts" style="margin:14px 0 6px"><a class="btn" href="#read">${icon("alert", "sm")}Read this first</a><a class="btn" href="#gates">${icon("gate", "sm")}Gates G0–G6</a><a class="btn" href="#qa">${icon("check", "sm")}QA tests</a><a class="btn" href="#approval">${icon("shield", "sm")}Final approval</a></div>
  ${WS.map(w => `<h2>Workstream ${w[0]} <span class="count">${esc(w[3])}</span></h2><p class="muted" style="margin-top:-6px">${esc(w[1])} · ${esc(w[2])}</p><div class="pbgrid">${w[4].map(id => { const p = PB.find(x => x.id === id), pr = pbProgress(p);
    return `<a class="card pbcard" href="#${p.id}">${ring(pr.d / pr.n * 100, 48)}<div class="t"><small>${p.no}${isMine(p.owner) ? " · yours" : ""}</small><b>${esc(p.title)}</b><small>${pr.d}/${pr.n} steps${pr.b ? ` · <span class="sev-high">${pr.b} blocked</span>` : ""}</small></div></a>`; }).join("")}</div>`).join("")}`;
}
function vRead() {
  return `<div class="eyebrow">Read this first</div><h1>How to use this guide</h1>
  <p>Configuration labels, API capabilities, permissions and subscription features change. Check the knowledge base article for each platform before making irreversible changes. No production cutover is authorised merely by reading this guide.</p>
  <div class="box info"><b>How the site works</b>Each playbook has step statuses, an implementation log, a problems-and-fixes log and the current vendor guidance. The tracking registry records every event, tag, trigger, variable and field in every system, so duplicates and naming differences show up before they spread.</div>
  <div class="box bad"><b>Risk gate</b>Credit-derived personal data must NOT be posted to ad platforms unless Wetility Legal/Information Officer and platform compliance have expressly approved that event definition, matching keys and legal basis. A threshold flag can still reveal financial information. Do not send SA ID numbers, credit scores, credit reports or raw WhatsApp transcripts to GTM, GA4, Amplitude or ad platforms.</div>
  <div class="box bad"><b>Live exposure check (before any other work)</b>The 620+ credit-score threshold is currently used as a signal sent back to ad platforms (confirmed in the August 2026 Ivy review). Under this guide's own risk gate, that is credit-derived data. Action by 7 Nov 2026: confirm whether Information Officer / Legal sign-off exists. If it exists, attach it as G1 evidence. If not, the Information Officer decides whether the signal continues pending review. Owner: Franta to raise; Information Officer [name TBC] to decide.</div>
  <div class="box warn"><b>Decision required: identifier strategy</b>The current Ivy closed loop uses the normalised phone number (+27 format) as the primary identifier between Freshsales, Amplitude and GA4. Playbook 4.5 moves to contract_id as the canonical join and prohibits matching on phone alone. Josh, Beryl and Timothy agree the migration path before Workstream 2 starts.</div>
  <div class="box"><b>What changed since manual v1.1 (31 Oct 2026 research)</b><ul style="margin:6px 0 0;padding-left:18px"><li>Google: new offline-conversion imports must use the Data Manager API (Google Ads API cutoff 15 June 2026 for new adopters).</li><li>Meta: CRM Conversion Leads only supports Meta Lead Ads. Website leads use web CAPI; WhatsApp leads use CAPI for Business Messaging with ctwa_clid and a 7-day window.</li><li>TikTok: optimise on a stage only with more than about 50 signals in 14 days.</li><li>GA4 Measurement Protocol only accepts events up to 72 hours old, so late milestones go to Amplitude.</li><li>Wetility App (Branch.io and Firebase) added as playbook 4.13.</li></ul></div>
  ${commentsBlock("read")}`;
}
function vGates() {
  return `<div class="eyebrow">Governance</div><h1>Non-negotiable gates</h1><p class="muted">A gate must be approved before work advances past it.</p>
  <div class="list">${GATES.map(g => `<div class="row"><div class="num">${g[0]}</div><div class="txt"><b>${esc(g[1])}</b><div>${esc(g[2])}</div><div class="by">Approver: ${esc(g[3])}</div></div><div>${sel("gate-" + g[0], GATE_OPTS)}</div></div>`).join("")}</div>
  ${logBlock("gates", GATES.map(g => g[0] + " " + g[1]))}${issueBlock("gates", GATES.map(g => g[0] + " " + g[1]))}${commentsBlock("gates")}`;
}
function vWS() {
  return `<div class="eyebrow">Sequence</div><h1>Workstreams and accountable owners</h1><p class="muted">Timing is indicative, not an engineering commitment.</p>
  <div class="tbl"><table><tr><th>WS</th><th>Workstream</th><th>Proposed owner</th><th>Window</th><th>Progress</th></tr>${WS.map(w => { const pr = w[4].map(id => pbProgress(PB.find(p => p.id === id))).reduce((a, r) => ({ d: a.d + r.d, b: a.b + r.b, g: a.g + r.g, n: a.n + r.n }), { d: 0, b: 0, g: 0, n: 0 });
    return `<tr><td class="n">${w[0]}</td><td>${esc(w[1])}<div class="by muted">${w[4].map(id => `<a href="#${id}">${PB.find(x => x.id === id).no}</a>`).join(" · ")}</div></td><td>${esc(w[2])}</td><td class="n">${w[3]}</td><td style="min-width:110px">${bar(pr)}<div class="by muted">${pr.d}/${pr.n} done${pr.b ? `, ${pr.b} blocked` : ""}</div></td></tr>`; }).join("")}</table></div>${commentsBlock("ws")}`;
}
function inlineLog(sec, ref, key) {
  return `<form class="f inline" data-form="log" data-sec="${sec}"><input type="hidden" name="ref" value="${esc(ref)}"><div class="two"><label for="ld-${key}">Date implemented<input id="ld-${key}" name="date" type="date" required value="${new Date().toISOString().slice(0, 10)}"></label><label for="le-${key}">Evidence link (optional)<input id="le-${key}" name="evidence" type="url" placeholder="https://"></label></div>
  <label for="lt-${key}">What did you implement?<textarea id="lt-${key}" name="text" required maxlength="4000"></textarea></label><div class="acts"><button class="btn primary" type="submit">Record</button><button class="btn ghost" type="button" data-act="inline" data-k="">Cancel</button></div></form>`;
}
function inlineIssue(sec, ref, key) {
  return `<form class="f inline" data-form="issue" data-sec="${sec}" data-ref="${esc(ref)}"><label for="it-${key}">What is not working?<input id="it-${key}" name="title" required maxlength="200"></label>
  <div class="two"><label for="is-${key}">Severity<select id="is-${key}" name="severity"><option value="high">High: blocks the work</option><option value="medium" selected>Medium</option><option value="low">Low</option></select></label></div>
  <label for="id-${key}">Details (what you tried, error messages)<textarea id="id-${key}" name="detail" maxlength="4000"></textarea></label><div class="acts"><button class="btn primary" type="submit">Log problem</button><button class="btn ghost" type="button" data-act="inline" data-k="">Cancel</button></div></form>`;
}
function stepCard(p, kind, i, text) {
  const key = `${p.id}-${kind}${i + 1}`, v = st(key), ref = kind === "s" ? `Step ${i + 1}: ${text.slice(0, 60)}${text.length > 60 ? "…" : ""}` : `Test A${i + 1}`;
  const logs = S.data.logs.filter(l => l.sec === p.id && l.ref === ref).length, probs = S.data.issues.filter(x => x.sec === p.id && x.ref === ref && x.state === "open").length;
  return `<div class="step" data-v="${v}"><div class="marker">${v === "done" || v === "pass" ? icon("check", "sm") : v === "blocked" || v === "fail" ? icon("x", "sm") : kind === "s" ? i + 1 : "A" + (i + 1)}</div>
  <div class="body"><div>${esc(text)}</div>${canWrite() ? `<div class="tools"><button class="btn ghost" data-act="inline" data-k="${key}-log">${icon("log", "sm")}Log what I did${logs ? ` (${logs})` : ""}</button><button class="btn ghost" data-act="inline" data-k="${key}-iss">${icon("alert", "sm")}Report a problem${probs ? ` (${probs} open)` : ""}</button></div>` : ""}</div>
  <div class="stctlwrap">${sel(key, kind === "s" ? STEP_OPTS : TEST_OPTS)}</div>
  ${S.inline === key + "-log" ? `<div class="inline">${inlineLog(p.id, ref, key)}</div>` : S.inline === key + "-iss" ? `<div class="inline">${inlineIssue(p.id, ref, key)}</div>` : ""}</div>`;
}
function vPB(p) {
  const pr = pbProgress(p), refs = [...p.steps.map((s, i) => `Step ${i + 1}: ${s.slice(0, 60)}${s.length > 60 ? "…" : ""}`), ...p.tests.map((t, i) => `Test A${i + 1}`), "General"];
  const tab = (S.pbTab ||= {})[p.id] || "steps";
  const kb = S.data.kb.filter(k => (k.pbs || []).includes(p.id));
  const openP = S.data.issues.filter(x => x.sec === p.id && x.state === "open").length, nLog = S.data.logs.filter(l => l.sec === p.id).length, nCom = S.data.comments.filter(c => c.sec === p.id).length;
  const T = [["steps", "Steps", pr.n, false], ["guidance", "Vendor guidance", kb.length, false], ...(p.kpis.length ? [["results", "Results", p.kpis.length, false]] : []), ["problems", "Problems", openP, openP > 0], ["log", "Implemented", nLog, false], ["discuss", "Discussion", nCom, false]];
  const i = PB.indexOf(p), prev = PB[i - 1], next = PB[i + 1];
  let body = "";
  if (tab === "steps") body = `${p.note ? `<div class="box warn"><b>Before you start</b>${esc(p.note)}</div>` : ""}<div class="box info"><b>Prerequisites</b>${esc(p.pre)}</div>
    <div class="steps">${p.steps.map((s, k) => stepCard(p, "s", k, s)).join("")}</div>
    <h2>${icon("check")} Acceptance tests</h2><div class="steps">${p.tests.map((t, k) => stepCard(p, "t", k, t)).join("")}</div>
    ${p.avoid ? `<h2>${icon("alert")} Avoid</h2><div class="avoid">${esc(p.avoid)}</div>` : ""}`;
  else if (tab === "guidance") body = kbPanel(p.id) || `<div class="empty">${icon("bulb")}No knowledge-base articles linked to this playbook yet.</div>`;
  else if (tab === "results") body = `<div class="grid2">${p.kpis.map(id => kpiCard(KPIS.find(k => k.id === id))).join("")}</div>`;
  else if (tab === "problems") body = issueBlock(p.id, refs);
  else if (tab === "log") body = logBlock(p.id, refs);
  else body = commentsBlock(p.id);
  return `<div class="eyebrow"><a href="#playbooks">Playbooks</a> · Workstream ${p.ws}</div>
  <div class="pbhead" style="margin-top:8px"><span class="pbno">${p.no}</span><h1>${esc(p.title)}</h1><div style="margin-left:auto">${ring(pr.d / pr.n * 100, 58)}</div></div>
  <p class="lede">${esc(p.obj)}</p>
  <div class="ownerchips">${p.owner.split(/[;+]/).map(o => o.trim()).filter(Boolean).map(o => `<span class="pill">${icon("user", "sm")}${esc(o.replace(/\(proposed, confirm\)/, "").trim())}</span>`).join("")}${/confirm/.test(p.owner) ? `<span class="pill warn">owners to confirm</span>` : ""}</div>
  <div class="tabs" role="tablist">${T.map(([k, l, n, hot]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? "on" : ""}" data-act="pbtab" data-pb="${p.id}" data-tab="${k}">${l}${n ? ` <span class="count${hot ? " hot" : ""}">${n}</span>` : ""}</button>`).join("")}</div>
  ${body}
  <div class="pbnav">${prev ? `<a class="card" href="#${prev.id}"><small>${icon("back", "sm")} Previous</small>${prev.no} ${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a class="card" href="#${next.id}" style="text-align:right"><small>Next ${icon("chev", "sm")}</small>${next.no} ${esc(next.title)}</a>` : ""}</div>`;
}
function vQA() {
  return `<div class="eyebrow">Prove it works</div><h1>QA test cases</h1><p class="muted">Run each scenario on staging and record the outcome.</p>
  <div class="list">${QA.map(q => `<div class="row"><div class="num">${q[0]}</div><div class="txt"><b>${esc(q[1])}</b><div class="by">Expected: ${esc(q[2])}</div></div><div>${sel("qa-" + q[0], TEST_OPTS)}</div></div>`).join("")}</div>
  ${logBlock("qa", QA.map(q => q[0] + " " + q[1]))}${issueBlock("qa", QA.map(q => q[0] + " " + q[1]))}${commentsBlock("qa")}`;
}
function vResults() {
  const grp = g => KPIS.filter(k => k.grp === g);
  return `<div class="eyebrow">Prove it works</div><h1>Is the implementation delivering?</h1>
  <p class="muted">Integrity KPIs prove the plumbing is right. Business outcomes prove it changed the commercial result.</p>
  <div class="box info"><b>Counting rules</b>Report leads and funnel from the cohort-based Ivy tracker; report installations from finance actuals by calendar month. Do not sum platform-attributed installs across Google, Meta and TikTok.</div>
  <h2>Integrity</h2><div class="grid2">${grp("Integrity").map(kpiCard).join("")}</div>
  <h2>Business outcomes</h2><div class="grid2">${grp("Business outcome").map(kpiCard).join("")}</div>${commentsBlock("results")}`;
}
function vLog() {
  return `<div class="eyebrow">Prove it works</div><h1>Implementation log</h1><div class="acts"><a class="btn" href="/api/export/logs.csv">Download CSV</a></div>
  <div class="feed" style="margin-top:12px">${S.data.logs.length ? S.data.logs.map(entryHTML).join("") : `<div class="empty">No entries yet.</div>`}</div>`;
}
function vIssues() {
  const f = S.flag || "open", list = S.data.issues.filter(x => f === "all" || x.state === f);
  return `<div class="eyebrow">Prove it works</div><h1>Problems and fixes</h1><p class="muted">Everything logged as not working, and what fixed it. Log new problems from the playbook or registry entry they belong to.</p>
  <div class="filters"><select id="iflt" aria-label="Show"><option value="open" ${f === "open" ? "selected" : ""}>Open</option><option value="resolved" ${f === "resolved" ? "selected" : ""}>Resolved</option><option value="all" ${f === "all" ? "selected" : ""}>All</option></select><a class="btn" href="/api/export/issues.csv">Download CSV</a></div>
  <div class="feed">${list.length ? list.map(issueHTML).join("") : `<div class="empty">Nothing here.</div>`}</div>`;
}

// ---------- views: tracking registry ----------
// A stat that leads somewhere is a link with a chevron; one that does not is plain text, so nothing looks tappable unless it is.
function tile(n, l, go) {
  if (!go) return `<div class="tile flat"><div class="n">${n}</div><div class="l">${l}</div></div>`;
  const inner = `<div class="n">${n}</div><div class="l">${l}</div>${icon("chev", "sm go")}`;
  return go.startsWith("#") ? `<a class="tile link" href="${go}">${inner}</a>` : `<button class="tile link" data-act="scrollto" data-t="${go}">${inner}</button>`;
}
const secId = t => "sec-" + String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-");
function fieldCard(f) {
  const A = S.A, impls = (A.byField[f.id] || []).filter(i => i.state !== "deprecated");
  const rows = SYSTEMS.map(s => { const here = impls.filter(i => i.system === s.id);
    if (here.length) return `<div class="rc-row"><span class="rc-sys">${esc(s.short)}</span><span class="rc-cells">${here.map(chip).join(" ")}</span></div>`;
    if ((f.expected || []).includes(s.id)) return `<div class="rc-row"><span class="rc-sys">${esc(s.short)}</span><span class="rc-cells"><span class="cell c-missing">missing</span></span></div>`;
    return ""; }).join("");
  return `<div class="card regcard"><a class="rc-head" href="#f-${f.id}"><span><b>${esc(f.name)}</b><span class="by">${esc(f.kind)}${f.pii !== "none" ? ` · <span class="${f.pii === "sensitive" ? "sev-high" : ""}">${esc(f.pii)}</span>` : ""}</span></span>${icon("chev", "sm")}</a>${rows || `<div class="by" style="padding:6px 0">Not recorded in any system yet.</div>`}</div>`;
}
function fieldRow(f) {
  const A = S.A, impls = (A.byField[f.id] || []).filter(i => i.state !== "deprecated");
  let first = {};
  return `<tr><td class="fname"><a href="#f-${f.id}"><b>${esc(f.name)}</b></a><div class="by muted">${esc(f.kind)}${f.pii !== "none" ? ` · <span class="${f.pii === "sensitive" ? "sev-high" : ""}">${esc(f.pii)}</span>` : ""}${f.status !== "approved" ? ` · ${esc(f.status)}` : ""}</div></td>${SYSTEMS.map(s => {
    const here = impls.filter(i => i.system === s.id), isFirst = !first[s.layer]; first[s.layer] = 1;
    const cls = isFirst ? ' class="first"' : "";
    if (here.length) return `<td${cls}>${here.map(chip).join(" ")}</td>`;
    if ((f.expected || []).includes(s.id)) return `<td${cls}><span class="cell c-missing" title="Expected here but not recorded">missing</span></td>`;
    return `<td${cls}></td>`; }).join("")}</tr>`;
}
function vRegistry() {
  const A = S.A, qy = norm(S.regQ || ""), kind = S.regKind || "", prob = S.regProb || "";
  let fields = S.data.fields.filter(f => f.status !== "deprecated");
  if (kind) fields = fields.filter(f => f.kind === kind);
  if (qy) fields = fields.filter(f => [f.name, f.description, f.measures, ...(f.aliases || []), ...(A.byField[f.id] || []).flatMap(i => [i.name, i.label, i.container])].some(x => norm(x).includes(qy)));
  if (prob) fields = fields.filter(f => { const im = A.byField[f.id] || []; return im.some(i => !["consistent", "platform"].includes(A.code[i.id]) || A.privIds.has(i.id) || A.dupIds.has(i.id)) || A.missing.some(([m]) => m.id === f.id); });
  const layerCounts = LAYERS.map(l => [l, SYSTEMS.filter(s => s.layer === l).length]);
  return `<div class="eyebrow">Data and tracking</div><h1>Tracking registry</h1>
  <p class="muted">One row per canonical event or field, one column per system, ordered by how data flows. Each cell shows the name used in that system. Click a field to see what it measures, where it is implemented, and to align names.</p>
  <div class="tiles">${tile(S.data.fields.filter(f => f.status !== "deprecated").length, "Canonical fields")}${tile(S.data.impls.length, "Items across systems", "#flow")}${tile(A.score == null ? "–" : A.score + "%", "Names consistent", "#consistency")}${tile(A.problems, "Problems to fix", "#consistency")}</div>
  <div class="filters"><input id="regq" type="search" placeholder="Filter by name, alias, GTM label or container" value="${esc(S.regQ || "")}" aria-label="Filter registry">
   <select id="regkind" aria-label="Type"><option value="">All types</option>${["event", "identifier", "parameter", "attribute"].map(k => `<option ${kind === k ? "selected" : ""}>${k}</option>`).join("")}</select>
   <select id="regprob" aria-label="Problems"><option value="">All fields</option><option value="1" ${prob ? "selected" : ""}>Only fields with problems</option></select>
   ${canWrite() ? `<a class="btn primary" href="#import">Import current setup</a><a class="btn" href="#add">Add one item</a>` : ""}<a class="btn" href="/api/export/registry.csv">Download CSV</a></div>
  <div class="legend"><span><span class="cell c-consistent">name</span>Consistent</span><span><span class="cell c-platform">name</span>Platform-required name</span><span><span class="cell c-differs">name</span>Name differs</span><span><span class="cell c-pending">name</span>Rename pending</span><span><span class="cell c-unconfirmed">name</span>To confirm</span><span><span class="cell c-dup">name</span>Duplicate</span><span><span class="cell c-privacy">name</span>Privacy conflict</span><span><span class="cell c-missing">missing</span>Expected, not recorded</span></div>
  <div class="regcards">${fields.map(fieldCard).join("") || `<div class="empty">No fields match.</div>`}</div>
  <div class="tbl regwrap"><table class="regtbl"><tr><th rowspan="2">Canonical field</th>${layerCounts.map(([l, n]) => `<th class="layer" colspan="${n}">${l}</th>`).join("")}</tr><tr>${SYSTEMS.map(s => `<th><a href="#sys-${s.id}">${esc(s.short)}</a></th>`).join("")}</tr>
  ${fields.map(fieldRow).join("") || `<tr><td colspan="${SYSTEMS.length + 1}" class="muted">No fields match.</td></tr>`}</table></div>
  ${A.unmapped.length ? `<h2>Items not mapped to a canonical field</h2><p class="muted">Map each to an existing field, or create a canonical field if it is genuinely new.</p>${A.unmapped.map(unmappedRow).join("")}` : ""}`;
}
function fieldOptions(selected, allowNone) {
  return `${allowNone ? `<option value="">Not mapped yet</option>` : ""}${S.data.fields.filter(f => f.status !== "deprecated").map(f => `<option value="${f.id}" ${f.id === selected ? "selected" : ""}>${esc(f.name)} (${f.kind})</option>`).join("")}`;
}
function unmappedRow(i) {
  return `<div class="impl"><div class="t"><b>${esc(sysName(i.system))}</b><span class="muted">${esc(i.kind)}</span><code>${esc(i.name)}</code>${i.label ? `<span class="muted">${esc(i.label)}</span>` : ""}</div>${i.description ? `<div class="muted" style="font-size:13px">${esc(i.description)}</div>` : ""}
  ${canWrite() ? `<div class="acts"><label class="muted" for="map-${i.id}" style="font-size:12.5px">Map to</label><select id="map-${i.id}" data-act="map" data-id="${i.id}">${fieldOptions(null, true)}</select></div>` : ""}</div>`;
}
function implCard(i, f) {
  const A = S.A, c = A.code[i.id];
  const notes = [];
  if (A.privIds.has(i.id)) notes.push(`<span class="pill bad">Privacy conflict: ${esc(f?.pii)} data must not be in ${esc(sysName(i.system))}</span>`);
  if (A.dupIds.has(i.id)) notes.push(`<span class="pill bad">Duplicate in ${esc(sysName(i.system))}</span>`);
  const acts = canWrite() ? [
    ["differs", "old"].includes(c) ? `<button class="btn" data-act="align" data-id="${i.id}">Align name to ${esc(f.name)}</button>` : "",
    c === "pending" ? `<button class="btn primary" data-act="renamed" data-id="${i.id}">Renamed in ${esc(sysName(i.system))}</button>` : "",
    ["differs", "old", "pending"].includes(c) ? `<button class="btn" data-act="std-on" data-id="${i.id}" title="The platform dictates this name, or it cannot be renamed (for example a Freshsales API key)">Name is fixed</button>` : "",
    c === "platform" ? `<button class="btn" data-act="std-off" data-id="${i.id}">Not platform-required</button>` : "",
    `<button class="btn" data-act="del-impl" data-id="${i.id}">Delete</button>`].join("") : "";
  return `<div class="impl"><div class="t"><b>${esc(sysName(i.system))}</b><span class="muted">${esc(i.kind)}</span>${chip(i)}<span class="pill ${i.state === "live" ? "ok" : i.state === "rename-pending" ? "warn" : ""}">${esc(i.state)}</span><span class="muted" style="font-size:12px">${esc(CODE_LABEL[c] || "")}</span></div>
  ${i.rename_to ? `<div style="font-size:13px">Rename to <code>${esc(i.rename_to)}</code> in ${esc(sysName(i.system))}, then confirm.</div>` : ""}
  ${i.label || i.container || i.parent ? `<div class="muted" style="font-size:12.5px">${[i.container && "Container " + esc(i.container), i.label && "Shown as " + esc(i.label), i.parent && "Fires on / belongs to " + esc(i.parent)].filter(Boolean).join(" · ")}</div>` : ""}
  ${i.description ? `<div style="font-size:13px">${esc(i.description)}</div>` : ""}${notes.length ? `<div class="chiprow">${notes.join("")}</div>` : ""}
  <div class="by muted">${i.by_user ? esc(nameOf(i.by_user)) + " · " : ""}${fmtD(i.at)}</div>
  ${canWrite() ? `<div class="acts">${acts}</div><details><summary class="muted" style="font-size:12.5px;cursor:pointer">Edit details</summary>${implForm(i)}</details>` : ""}</div>`;
}
function implForm(i = {}) {
  const sys = i.system || S.prefSys || "gtm", id = i.id || "new";
  const kinds = [...new Set([...(SYS[sys]?.kinds || []), ...(i.kind ? [i.kind] : [])])];
  return `<form class="f" data-form="impl" data-id="${i.id || ""}">
  <div class="two"><label for="if-${id}">Canonical field<select id="if-${id}" name="field_id">${fieldOptions(i.field_id ?? S.prefField, true)}</select></label>
  <label for="is-${id}">System<select id="is-${id}" name="system" data-kinds="ik-${id}">${SYSTEMS.map(s => `<option value="${s.id}" ${s.id === sys ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label></div>
  <div class="two"><label for="ik-${id}">Type<input id="ik-${id}" name="kind" list="kl-${id}" required value="${esc(i.kind || kinds[0] || "")}"><datalist id="kl-${id}">${kinds.map(k => `<option value="${esc(k)}">`).join("")}</datalist></label>
  <label for="in-${id}">Name as it appears in the data<input id="in-${id}" name="name" required maxlength="160" value="${esc(i.name || "")}" placeholder="e.g. generate_lead"></label></div>
  <div class="two"><label for="il-${id}">Display name in the tool (optional)<input id="il-${id}" name="label" maxlength="200" value="${esc(i.label || "")}" placeholder="e.g. GA4 Event - generate_lead"></label>
  <label for="ic-${id}">Container / property / account (optional)<input id="ic-${id}" name="container" maxlength="120" value="${esc(i.container || "")}" placeholder="e.g. GTM-N9XFQZMK"></label></div>
  <div class="two"><label for="ip-${id}">Fires on / belongs to (optional)<input id="ip-${id}" name="parent" maxlength="200" value="${esc(i.parent || "")}" placeholder="e.g. CE - lead_submitted"></label>
  <label for="ist-${id}">State<select id="ist-${id}" name="state">${["planned", "live", "rename-pending", "deprecated"].map(s => `<option ${s === (i.state || "planned") ? "selected" : ""}>${s}</option>`).join("")}</select></label></div>
  <label for="id-${id}">What it tracks or measures, and any notes<textarea id="id-${id}" name="description" maxlength="1000">${esc(i.description || "")}</textarea></label>
  <label style="display:flex;gap:8px;align-items:center;color:var(--fg)"><input type="checkbox" name="std" ${i.std ? "checked" : ""} style="width:auto"> The platform requires this exact name (for example GA4 generate_lead, Meta Lead)</label>
  <div class="acts"><button class="btn primary" type="submit">${i.id ? "Save changes" : "Add to registry"}</button></div></form>`;
}
function vField(id) {
  const f = S.data.fields.find(x => x.id === id);
  if (!f) return `<h1>Field not found</h1><p><a href="#registry">Back to the registry</a></p>`;
  const A = S.A, impls = (A.byField[f.id] || []);
  const miss = (f.expected || []).filter(s => !impls.some(i => i.system === s && i.state !== "deprecated"));
  const similar = A.similar.filter(([x, y]) => x.id === f.id || y.id === f.id).map(([x, y]) => x.id === f.id ? y : x);
  const hist = S.data.audit.filter(a => (a.entity === "field" && a.entity_id === f.id) || (a.entity === "impl" && impls.some(i => String(i.id) === a.entity_id)));
  return `<div class="eyebrow">Canonical ${esc(f.kind)} · <a href="#registry">Tracking registry</a></div><h1><code style="font-size:.85em">${esc(f.name)}</code></h1>
  ${f.merged_into ? `<div class="box warn"><b>Merged</b>This field was merged into <a href="#f-${esc(f.merged_into)}">${esc(f.merged_into)}</a>.</div>` : ""}
  <dl class="meta"><div><dt>What it is</dt><dd>${esc(f.description) || "–"}</dd></div><div><dt>What it measures</dt><dd>${esc(f.measures) || "–"}</dd></div><div><dt>Owner · data class · status</dt><dd>${esc(f.owner || "–")} · <span class="${f.pii === "sensitive" ? "sev-high" : ""}">${esc(f.pii)}</span> · ${esc(f.status)}</dd></div>${(f.aliases || []).length ? `<div><dt>Old or alternative names</dt><dd>${f.aliases.map(a => `<code>${esc(a)}</code>`).join(", ")}</dd></div>` : ""}</dl>
  ${similar.length ? `<div class="box warn"><b>Possible duplicate field${similar.length > 1 ? "s" : ""}</b>${similar.map(s => `<a href="#f-${s.id}">${esc(s.name)}</a>`).join(", ")} look like the same thing. ${canWrite() ? `Merge them below so only one name survives.` : ""}</div>` : ""}
  <h2>Where it lives, in data-flow order</h2><div class="list">${LAYERS.map(l => { const sys = SYSTEMS.filter(s => s.layer === l).map(s => s.id); const here = impls.filter(i => sys.includes(i.system)); const m = miss.filter(s => sys.includes(s));
    if (!here.length && !m.length) return "";
    return `<div class="lane"><b>${l}</b><div>${here.map(i => implCard(i, f)).join("")}${m.map(s => `<div class="impl"><div class="t"><b>${esc(sysName(s))}</b><span class="cell c-missing">missing</span><span class="muted" style="font-size:13px">Expected here but not recorded.</span>${canWrite() ? `<a class="btn" href="#add" data-act="prefill" data-sys="${s}" data-field="${f.id}" style="padding:2px 8px;font-size:12px">Record it</a>` : ""}</div></div>`).join("")}</div></div>`; }).join("")}</div>
  ${canWrite() ? `<details><summary class="btn" style="display:inline-block;margin-top:10px">Add where this is implemented</summary>${(S.prefField = f.id, implForm({ field_id: f.id }))}</details>` : ""}
  ${canWrite() ? `<h2>Edit, rename or merge</h2><details><summary class="btn" style="display:inline-block">Edit or rename this field</summary><form class="f" data-form="field-edit" data-id="${f.id}">
   <div class="two"><label for="fn">Canonical name<input id="fn" name="name" required maxlength="60" value="${esc(f.name)}"></label><label for="fk">Type<select id="fk" name="kind">${["event", "identifier", "parameter", "attribute"].map(k => `<option ${k === f.kind ? "selected" : ""}>${k}</option>`).join("")}</select></label></div>
   <label for="fdsc">What it is<textarea id="fdsc" name="description" maxlength="1000">${esc(f.description)}</textarea></label>
   <label for="fms">What it measures<input id="fms" name="measures" maxlength="500" value="${esc(f.measures)}"></label>
   <div class="two"><label for="fpii">Data class<select id="fpii" name="pii">${["none", "pseudonymous", "personal", "sensitive"].map(k => `<option ${k === f.pii ? "selected" : ""}>${k}</option>`).join("")}</select></label><label for="fo">Owner<input id="fo" name="owner" maxlength="80" value="${esc(f.owner)}"></label></div>
   <div class="two"><label for="fst">Status<select id="fst" name="status">${["approved", "proposed", "deprecated"].map(k => `<option ${k === f.status ? "selected" : ""}>${k}</option>`).join("")}</select></label><label for="fal">Old or alternative names (comma separated)<input id="fal" name="aliases" value="${esc((f.aliases || []).join(", "))}"></label></div>
   <fieldset style="border:1px solid var(--line);border-radius:6px"><legend class="muted" style="font-size:12.5px">Systems where it should exist</legend><div class="chiprow">${SYSTEMS.map(s => `<label style="display:flex;gap:4px;align-items:center;color:var(--fg)"><input type="checkbox" name="expected" value="${s.id}" ${(f.expected || []).includes(s.id) ? "checked" : ""} style="width:auto">${esc(s.short)}</label>`).join("")}</div></fieldset>
   <p class="muted" style="font-size:12.5px">Renaming keeps the old name as an alias, and every system still using it will show "Uses an old name" until aligned.</p>
   <div class="acts"><button class="btn primary" type="submit">Save field</button></div></form></details>
   <details><summary class="btn" style="display:inline-block;margin-top:8px">Merge into another field</summary><form class="f" data-form="merge" data-id="${f.id}"><label for="mi">Keep this field and move everything to it<select id="mi" name="into" required><option value="">Choose a field</option>${S.data.fields.filter(x => x.id !== f.id && x.status !== "deprecated").map(x => `<option value="${x.id}" ${similar.some(s => s.id === x.id) ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label><p class="muted" style="font-size:12.5px">All implementations move to the chosen field, ${esc(f.name)} becomes its alias, and this field is marked deprecated.</p><div class="acts"><button class="btn primary" type="submit">Merge</button></div></form></details>` : ""}
  ${issueBlock("registry", [], f.id)}
  <h2>Change history</h2>${hist.length ? `<div class="feed">${hist.slice(0, 30).map(auditHTML).join("")}</div>` : `<div class="empty">No changes recorded yet.</div>`}`;
}
function auditHTML(a) {
  const d = a.detail || {};
  const what = a.action === "renamed" ? `renamed ${d.system ? sysName(d.system) + " " : ""}<code>${esc(d.from)}</code> to <code>${esc(d.to)}</code>`
    : a.action === "rename requested" ? `requested ${esc(sysName(d.system))} rename <code>${esc(d.from)}</code> to <code>${esc(d.to)}</code>`
    : a.action === "merged" ? `merged <code>${esc(d.from_name)}</code> into <code>${esc(d.into_name)}</code>`
    : `${esc(a.action)} ${esc(a.entity)} ${d.name ? `<code>${esc(d.name)}</code>` : d.title ? esc(d.title) : ""}`;
  return `<div class="entry"><div class="h"><b>${esc(nameOf(a.by_user))}</b><span>${fmtDT(a.at)}</span></div><p>${what}</p></div>`;
}
function vAdd() {
  return `<div class="eyebrow"><a href="#registry">Tracking registry</a></div><h1>Add to the registry</h1>
  <div class="box info"><b>Check before adding</b>Search first (top bar). If the event or field already exists under another name, map your item to that canonical field instead of creating a new one.</div>
  <h2>Record an item in a system</h2><p class="muted">A dataLayer event, GTM tag, trigger or variable, GA4 event, Firebase event, Branch event, Freshsales field, Zuper field, conversion action and so on.</p>${implForm({ system: S.prefSys, field_id: S.prefField })}
  <h2>Create a new canonical field</h2><p class="muted">Only when nothing in the registry means the same thing.</p>
  <form class="f" data-form="field-new"><div class="two"><label for="nfn">Canonical name (snake_case)<input id="nfn" name="name" required maxlength="60" placeholder="e.g. referral_sent"></label><label for="nfk">Type<select id="nfk" name="kind"><option>event</option><option>identifier</option><option>parameter</option><option>attribute</option></select></label></div>
  <label for="nfd">What it is<textarea id="nfd" name="description" maxlength="1000"></textarea></label><label for="nfm">What it measures<input id="nfm" name="measures" maxlength="500"></label>
  <div class="two"><label for="nfp">Data class<select id="nfp" name="pii"><option>none</option><option>pseudonymous</option><option>personal</option><option>sensitive</option></select></label><label for="nfo">Owner<input id="nfo" name="owner" maxlength="80"></label></div>
  <div class="acts"><button class="btn primary" type="submit">Create field</button></div></form>`;
}
function vConsistency() {
  const A = S.A;
  const sec = (title, why, items, row) => `<h2 id="${secId(title)}">${title} <span class="muted" style="font:400 14px var(--f-body)">${items.length}</span></h2><p class="muted">${why}</p>${items.length ? items.map(row).join("") : `<div class="empty">None.</div>`}`;
  const implLine = (i, extra = "") => { const f = A.fieldOf(i.field_id); return `<div class="impl"><div class="t"><b>${esc(sysName(i.system))}</b><span class="muted">${esc(i.kind)}</span>${chip(i)}${f ? `<span class="muted">→</span><a href="#f-${f.id}"><code>${esc(f.name)}</code></a>` : ""}${i.label ? `<span class="muted" style="font-size:12.5px">${esc(i.label)}</span>` : ""}</div>${extra}</div>`; };
  const acts = i => canWrite() ? `<div class="acts">${A.code[i.id] === "pending" ? `<button class="btn primary" data-act="renamed" data-id="${i.id}">Renamed in ${esc(sysName(i.system))}</button>` : `<button class="btn" data-act="align" data-id="${i.id}">Align to canonical</button>`}<button class="btn" data-act="std-on" data-id="${i.id}">Name is fixed</button></div>` : "";
  return `<div class="eyebrow">Data and tracking</div><h1>Consistency check</h1>
  <p class="muted">Recalculated from the registry every time it changes. Work top to bottom: privacy first, then duplicates, then names.</p>
  <div class="tiles">${tile(A.score == null ? "–" : A.score + "%", "Names consistent (mapped items)")}${tile(A.privacy.length, "Privacy conflicts", secId("Privacy conflicts"))}${tile(A.dups.length + A.collisions.length + A.similar.length, "Duplicates", secId("Duplicate implementations"))}${tile(A.naming.length + A.pending.length, "Names to align", secId("Names that differ from the canonical name"))}${tile(A.missing.length, "Gaps", secId("Gaps: expected but not recorded"))}</div></div>
  ${sec("Privacy conflicts", "Data classed as sensitive or personal recorded in a browser, analytics or ad-platform system. Fix or get Information Officer approval.", A.privacy, i => implLine(i, `<div class="muted" style="font-size:13px">${esc(i.description)}</div>`))}
  ${sec("Duplicate implementations", "Two items in one system for the same canonical field (for example two Freshsales fields both holding the meter number), or the same item recorded twice. Keep one; deprecate or migrate the other.", A.dups, g => `<div class="box warn">${g.map(i => implLine(i)).join("")}</div>`)}
  ${sec("Name collisions", "The same name in one system used for two different canonical fields. One of them needs a different name.", A.collisions, g => `<div class="box warn">${g.map(i => implLine(i)).join("")}</div>`)}
  ${sec("Possible duplicate fields", "Two canonical fields that look like the same thing. Merge so only one name survives.", A.similar, ([x, y]) => `<div class="impl"><div class="t"><a href="#f-${x.id}"><code>${esc(x.name)}</code></a><span class="muted">and</span><a href="#f-${y.id}"><code>${esc(y.name)}</code></a></div>${canWrite() ? `<div class="acts"><button class="btn" data-act="merge" data-from="${y.id}" data-into="${x.id}">Keep ${esc(x.name)}</button><button class="btn" data-act="merge" data-from="${x.id}" data-into="${y.id}">Keep ${esc(y.name)}</button></div>` : ""}</div>`)}
  ${sec("Names that differ from the canonical name", "Align the name in the system, or mark it as platform-required if the platform dictates it (for example GA4 generate_lead).", A.naming, i => implLine(i, acts(i)))}
  ${sec("Renames in progress", "Agreed renames waiting to be done in the system. Confirm once changed.", A.pending, i => implLine(i, `<div style="font-size:13px">Rename to <code>${esc(i.rename_to)}</code></div>${acts(i)}`))}
  ${sec("Names to confirm", "Placeholders where the real name in the system still needs to be checked.", A.unconfirmed, i => implLine(i, `<div class="muted" style="font-size:13px">${esc(i.description)}</div>`))}
  ${sec("Not mapped to a canonical field", "Items recorded in a system with no canonical meaning yet.", A.unmapped, unmappedRow)}
  ${sec("Gaps: expected but not recorded", "The field should exist in these systems according to its definition. Record it, or remove the system from the field's expected list.", A.missing, ([f, s]) => `<div class="impl"><div class="t"><a href="#f-${f.id}"><code>${esc(f.name)}</code></a><span class="muted">missing in</span><b>${esc(sysName(s))}</b>${canWrite() ? `<a class="btn" href="#add" data-act="prefill" data-sys="${s}" data-field="${f.id}" style="padding:2px 8px;font-size:12px">Record it</a>` : ""}</div></div>`)}`;
}
function hopStats(a, b) {
  const A = S.A, shared = [], mism = [];
  S.data.fields.filter(f => f.status !== "deprecated").forEach(f => {
    const ia = (A.byField[f.id] || []).filter(i => i.system === a && i.state !== "deprecated"), ib = (A.byField[f.id] || []).filter(i => i.system === b && i.state !== "deprecated");
    if (!ia.length || !ib.length) return;
    shared.push(f);
    const na = ia.filter(i => !i.std && !/^\[/.test(i.name)).map(i => norm(i.name)), nb = ib.filter(i => !i.std && !/^\[/.test(i.name)).map(i => norm(i.name));
    if (na.length && nb.length && !na.some(x => nb.includes(x))) mism.push([f, ia, ib]);
  });
  return { shared, mism };
}
function vFlow() {
  const W = 1100, colW = W / LAYERS.length, nodeW = 168, nodeH = 44, gap = 14, top = 40;
  const pos = {}; let maxH = 0;
  LAYERS.forEach((l, ci) => { SYSTEMS.filter(s => s.layer === l).forEach((s, ri) => { pos[s.id] = { x: ci * colW + (colW - nodeW) / 2, y: top + ri * (nodeH + gap) }; maxH = Math.max(maxH, pos[s.id].y + nodeH); }); });
  const H = maxH + 20;
  const edges = FLOWS.map(([a, b]) => { const p = pos[a], q = pos[b]; if (!p || !q) return "";
    let x1 = p.x + nodeW, y1 = p.y + nodeH / 2, x2 = q.x, y2 = q.y + nodeH / 2;
    if (q.x <= p.x) { x1 = p.x + nodeW / 2; y1 = p.y + nodeH; x2 = q.x + nodeW / 2; y2 = q.y + nodeH; return `<path class="edge" d="M${x1},${y1} C${x1},${H} ${x2},${H} ${x2},${y2}" marker-end="url(#ah)"/>`; }
    const mx = (x1 + x2) / 2; return `<path class="edge" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 4},${y2}" marker-end="url(#ah)"/>`; }).join("");
  const counts = Object.fromEntries(SYSTEMS.map(s => [s.id, S.data.impls.filter(i => i.system === s.id && i.state !== "deprecated").length]));
  const nodes = SYSTEMS.map(s => { const p = pos[s.id]; return `<a href="#sys-${s.id}" class="node" tabindex="0" aria-label="${esc(s.name)}"><rect x="${p.x}" y="${p.y}" width="${nodeW}" height="${nodeH}" rx="6"/><text x="${p.x + 10}" y="${p.y + 19}">${esc(s.short)}</text><text class="sub" x="${p.x + 10}" y="${p.y + 35}">${counts[s.id]} item${counts[s.id] === 1 ? "" : "s"}</text></a>`; }).join("");
  const heads = LAYERS.map((l, i) => `<text class="lh" x="${i * colW + colW / 2}" y="20" text-anchor="middle">${l}</text>`).join("");
  return `<div class="eyebrow">Data and tracking</div><h1>How data flows between systems</h1>
  <p class="muted">Left to right: where data is created, collected, made canonical, analysed and sent to ad platforms. Click a system to see everything recorded in it, grouped by container and type.</p>
  <div class="flowlist">${LAYERS.map(l => `<h3>${l}</h3><div class="fl-nodes">${SYSTEMS.filter(s => s.layer === l).map(s => `<a class="tile link" href="#sys-${s.id}"><div class="l"><b style="color:var(--fg);font-size:16px">${esc(s.short)}</b><br>${counts[s.id]} item${counts[s.id] === 1 ? "" : "s"}</div>${icon("chev", "sm go")}</a>`).join("")}</div>`).join("")}</div>
  <div class="flowwrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Data flow between Wetility systems"><defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--muted)"/></marker></defs>${heads}${edges}${nodes}</svg></div>
  <h2>Native connections between these systems</h2><p class="muted">Built-in connectors Wetility can use instead of custom code, and the ones that do not exist. From the knowledge base; editors keep them current.</p>
  <div class="feed">${S.data.kb.filter(k => k.system === "native").map(k => `<a class="entry" href="#kb-${k.id}" style="text-decoration:none;color:inherit;display:block"><div class="h"><b>${esc(k.title)}</b>${kbBadge(k)}</div><p class="muted">${esc(k.summary.slice(0, 200))}${k.summary.length > 200 ? "…" : ""}</p></a>`).join("") || `<div class="empty">No native-integration articles yet.</div>`}</div>
  <h2>Name consistency at each hop</h2><p class="muted">For every connection, the fields recorded on both sides, and where the two systems use different names for the same thing (platform-required names excluded).</p>
  <div class="tbl"><table><tr><th>From</th><th>To</th><th>What travels</th><th>Shared fields</th><th>Different names</th></tr>${FLOWS.map(([a, b, w]) => { const h = hopStats(a, b);
    return `<tr><td><a href="#sys-${a}">${esc(sysName(a))}</a></td><td><a href="#sys-${b}">${esc(sysName(b))}</a></td><td>${esc(w)}</td><td class="n">${h.shared.length}</td><td>${h.mism.length ? h.mism.map(([f, ia, ib]) => `<a href="#f-${f.id}"><code>${esc(ia[0].name)}</code> vs <code>${esc(ib[0].name)}</code></a>`).join("<br>") : h.shared.length ? `<span class="pill ok">Consistent</span>` : `<span class="muted">–</span>`}</td></tr>`; }).join("")}</table></div>`;
}
function vSystem(id) {
  const s = SYS[id]; if (!s) return `<h1>System not found</h1>`;
  const items = S.data.impls.filter(i => i.system === id);
  const byC = {}; items.forEach(i => { ((byC[i.container || "(no container)"] ??= {})[i.kind] ??= []).push(i); });
  const kb = S.data.kb.filter(k => k.system === id);
  const flowsIn = FLOWS.filter(f => f[1] === id), flowsOut = FLOWS.filter(f => f[0] === id);
  return `<div class="eyebrow">${esc(s.layer)} · <a href="#flow">Data flow</a></div><h1>${esc(s.name)}</h1>
  <dl class="meta"><div><dt>Receives from</dt><dd>${flowsIn.map(f => `<a href="#sys-${f[0]}">${esc(sysName(f[0]))}</a>: ${esc(f[2])}`).join("<br>") || "–"}</dd></div><div><dt>Sends to</dt><dd>${flowsOut.map(f => `<a href="#sys-${f[1]}">${esc(sysName(f[1]))}</a>: ${esc(f[2])}`).join("<br>") || "–"}</dd></div>${kb.length ? `<div><dt>Knowledge base</dt><dd>${kb.map(k => `<a href="#kb-${k.id}">${esc(k.title)}</a>`).join("<br>")}</dd></div>` : ""}</dl>
  ${canWrite() ? `<div class="acts"><a class="btn primary" href="#add" data-act="prefill" data-sys="${id}">Record an item in ${esc(s.short)}</a></div>` : ""}
  <h2>Everything recorded here <span class="muted" style="font:400 14px var(--f-body)">${items.length}</span></h2>
  ${items.length ? `<div class="list tree">${Object.entries(byC).map(([c, kinds]) => `<details open><summary>${esc(c)}</summary>${Object.entries(kinds).map(([k, arr]) => `<div style="margin-top:8px"><div class="eyebrow" style="color:var(--muted)">${esc(k)} (${arr.length})</div><ul>${arr.map(i => { const f = S.A.fieldOf(i.field_id); return `<li>${chip(i)}${i.label ? `<span>${esc(i.label)}</span>` : ""}${i.parent ? `<span class="muted">↳ ${esc(i.parent)}</span>` : ""}<span class="muted">→</span>${f ? `<a href="#f-${f.id}">${esc(f.name)}</a>` : `<span class="pill warn">not mapped</span>`}${i.description ? `<span class="muted" style="font-size:12.5px">${esc(i.description)}</span>` : ""}</li>`; }).join("")}</ul></div>`).join("")}</details>`).join("")}</div>` : `<div class="empty">Nothing recorded in ${esc(s.short)} yet.</div>`}`;
}

// ---------- views: knowledge base ----------
function vKB() {
  const stale = k => k.review_flag || !k.verified_on || (Date.now() - new Date(k.verified_on)) / 864e5 > 90;
  const f = S.kbF || "all";
  const FIL = [["all", "All"], ["platform", "Platform guidance"], ["export", "Export guides"], ["native", "Native integrations"], ["stale", "Needs re-check"]];
  const list = S.data.kb.filter(k => f === "all" || (f === "export" ? k.id.startsWith("export-") : f === "native" ? k.system === "native" : f === "stale" ? stale(k) : !k.id.startsWith("export-") && k.system !== "native"));
  return `<div class="eyebrow">Knowledge</div><h1>Vendor guidance</h1>
  <p class="lede">How each platform works today, how to export its setup, and which built-in connections to use. Every article shows its sources and when it was last checked.</p>
  <div class="filters"><div class="seg-tabs">${FIL.map(([k, l]) => `<button data-act="kbf" data-f="${k}" class="${k === f ? "on" : ""}">${l}${k === "stale" ? ` (${S.data.kb.filter(stale).length})` : ""}</button>`).join("")}</div>${canWrite() ? `<a class="btn primary" href="#kb-new" style="margin-left:auto">${icon("plus", "sm")}New article</a>` : ""}</div>
  ${f === "stale" ? `<div class="box warn"><b>How to re-check</b>Open each article, follow its source links, update anything that changed, then click "mark verified today".</div>` : ""}
  <div class="kbgrid">${list.map(k => `<a class="card kbcard" href="#kb-${k.id}"><span class="sys">${esc(sysName(k.system))}</span><b>${esc(k.title)}</b><p>${esc(k.summary)}</p><div style="margin-top:auto">${kbBadge(k)}</div></a>`).join("") || `<div class="empty">${icon("bulb")}Nothing here.</div>`}</div>`;
}
function vKBArticle(id) {
  const k = S.data.kb.find(x => x.id === id); if (!k) return `<h1>Article not found</h1><p><a href="#kb">Knowledge base</a></p>`;
  const list = (t, a, ol) => a?.length ? `<h2>${t}</h2><${ol ? "ol" : "ul"} style="padding-left:20px;display:grid;gap:6px;max-width:72ch">${a.map(x => `<li>${esc(x)}</li>`).join("")}</${ol ? "ol" : "ul"}>` : "";
  return `<div class="eyebrow"><a href="#kb">Knowledge base</a> · ${esc(sysName(k.system))}</div><h1>${esc(k.title)}</h1>
  <div class="chiprow">${kbBadge(k)}${k.verified_by ? `<span class="muted" style="font-size:12.5px">by ${esc(k.verified_by)}</span>` : ""}${k.updated_by ? `<span class="muted" style="font-size:12.5px">Last edited by ${esc(nameOf(k.updated_by))} ${fmtD(k.updated_at)}</span>` : ""}</div>
  ${k.review_flag ? `<div class="box bad"><b>Flagged for review</b>${esc(k.review_note || "")}</div>` : ""}
  <p style="margin-top:12px">${esc(k.summary)}</p>
  ${list("Steps", k.steps, true)}${list("Good practice", k.practices)}${list("What changed versus the manual", k.changes)}
  <h2>Sources</h2><ul style="padding-left:20px">${(k.sources || []).map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join("") || "<li class='muted'>None recorded.</li>"}</ul>
  ${(k.pbs || []).length ? `<p class="muted">Used in: ${k.pbs.map(id => { const p = PB.find(x => x.id === id); return p ? `<a href="#${p.id}">${p.no} ${esc(p.title)}</a>` : ""; }).join(" · ")}</p>` : ""}
  ${canWrite() ? `<div class="acts"><button class="btn primary" data-act="kb-verify" data-id="${k.id}">I checked the sources: mark verified today</button><a class="btn" href="#kb-edit-${k.id}">Edit article</a></div>
  <details style="margin-top:8px"><summary class="btn" style="display:inline-block">Flag for review</summary><form class="f" data-form="kbflag" data-id="${k.id}"><label for="kfn">What looks out of date<textarea id="kfn" name="note" maxlength="1000" required></textarea></label><div class="acts"><button class="btn primary" type="submit">Flag article</button></div></form></details>` : ""}
  ${commentsBlock("kb-" + k.id)}`;
}
function vKBEdit(id) {
  const k = id ? S.data.kb.find(x => x.id === id) : { title: "", system: "gtm", pbs: [], summary: "", steps: [], practices: [], changes: [], sources: [] };
  if (!k) return `<h1>Article not found</h1>`;
  if (!canWrite()) return `<h1>View-only access</h1>`;
  return `<div class="eyebrow"><a href="#kb">Knowledge base</a></div><h1>${id ? "Edit article" : "New article"}</h1>
  <form class="f" data-form="kbedit" data-id="${esc(id || "")}">
  <div class="two"><label for="kt">Title<input id="kt" name="title" required maxlength="200" value="${esc(k.title)}"></label><label for="ks">System<select id="ks" name="system">${[...SYSTEMS, { id: "governance", name: "Governance and privacy" }, { id: "native", name: "Native integrations" }].map(s => `<option value="${s.id}" ${s.id === k.system ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label></div>
  <label for="ksum">Summary<textarea id="ksum" name="summary" maxlength="3000">${esc(k.summary)}</textarea></label>
  <label for="kst">Steps (one per line)<textarea id="kst" name="steps" rows="8">${esc((k.steps || []).join("\n"))}</textarea></label>
  <label for="kpr">Good practice (one per line)<textarea id="kpr" name="practices">${esc((k.practices || []).join("\n"))}</textarea></label>
  <label for="kch">What changed versus the manual (one per line)<textarea id="kch" name="changes">${esc((k.changes || []).join("\n"))}</textarea></label>
  <label for="ksrc">Sources (one per line: Title | https://link)<textarea id="ksrc" name="sources">${esc((k.sources || []).map(s => s.title + " | " + s.url).join("\n"))}</textarea></label>
  <fieldset style="border:1px solid var(--line);border-radius:6px"><legend class="muted" style="font-size:12.5px">Show in playbooks</legend><div class="chiprow">${PB.map(p => `<label style="display:flex;gap:4px;align-items:center;color:var(--fg)"><input type="checkbox" name="pbs" value="${p.id}" ${(k.pbs || []).includes(p.id) ? "checked" : ""} style="width:auto">${p.no}</label>`).join("")}</div></fieldset>
  <div class="acts"><button class="btn primary" type="submit">Save article</button><a class="btn" href="${id ? "#kb-" + id : "#kb"}">Cancel</a></div></form>`;
}

// ---------- views: reference ----------
function vRef() {
  return `<div class="eyebrow">Reference</div><h1>Schema and matching rules</h1>
  <p class="muted">The live list of event and field names is the <a href="#registry">tracking registry</a>. This page holds the design rules.</p>
  <h2>Minimal canonical conversion event</h2><pre>{
  "event_id": "commissioning:CONTRACT-123:v1",
  "event_type": "commissioning_completed",
  "entity_type": "contract",
  "entity_id": "CONTRACT-123",
  "source_system": "zuper",
  "source_record_id": "JOB-789",
  "occurred_at": "2026-10-30T10:25:00+02:00",
  "observed_at": "2026-10-30T10:27:31+02:00",
  "schema_version": "1.0",
  "attribution_ref": "ATTR-opaque",
  "consent_ref": "CONSENT-opaque",
  "validation_status": "verified"
}</pre>
  <h2>Web data layer contract</h2><pre>window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  event: "lead_submitted",
  event_id: "EVT-opaque-unique-id",
  lead_id: "WET-opaque-lead-id",
  lead_channel: "website",
  product_interest: "PACE_MAXI",
  form_type: "solar_enquiry"
});</pre>
  <h2>Suggested tables</h2><div class="tbl"><table><tr><th>Table</th><th>Minimum columns</th><th>Purpose</th></tr>${[["identity_link", "id_type, id_value_hash, entity_id, confidence, linked_at", "Safe cross-system join"], ["acquisition_touch", "touch_id, visitor_id, channel, campaign, click_ids, consent_ref, time", "Attribution history"], ["conversion_event", "event_id, event_type, entity_id, source, occurred_at, verified_at", "Canonical history"], ["platform_outbox", "event_id, platform, destination, status, attempts, last_error", "Reliable delivery"], ["reconciliation_exception", "contract_id, crm_deal_id, zuper_job_id, exception_type, owner, status", "Operational resolution"], ["intent_score_history", "conversation_id, score, tier, version, evidence_codes, scored_at", "Validation and audit"]].map(r => `<tr><td><code>${r[0]}</code></td><td><code>${r[1]}</code></td><td>${r[2]}</td></tr>`).join("")}</table></div>
  <h2>Naming rules</h2><div class="list">${["Canonical names are lower snake_case, past-tense for events (lead_submitted, commissioning_completed).", "Use the canonical name everywhere you control the name: dataLayer, GTM triggers and variables, ledger, Amplitude, Firebase custom events, Freshsales stage keys, conversion action names.", "Where a platform dictates the name (GA4 generate_lead, Meta Lead, Branch INSTALL), record it and tick 'platform requires this name'.", "Before adding anything, search the registry. Map to an existing field rather than creating a near-duplicate.", "Never merge Zuper jobs or Freshsales deals solely because they share a mobile number. Prefer verified contract identifiers.", "Preserve first acquisition and later touches separately; never overwrite the original gclid, fbc, ttclid or ctwa_clid.", "One commissioning event per contract/system, not one per Zuper job or webhook message."].map((r, i) => `<div class="row" style="grid-template-columns:34px minmax(0,1fr)"><div class="num">R${i + 1}</div><div class="txt">${esc(r)}</div></div>`).join("")}</div>
  ${commentsBlock("ref")}`;
}
function vDay1() {
  const block = (pfx, arr) => `<div class="list">${arr.map((t, i) => `<div class="row"><div class="num">${String(i + 1).padStart(2, "0")}</div><div class="txt">${esc(t)}</div><div>${sel(`${pfx}-${i + 1}`, CHECK_OPTS)}</div></div>`).join("")}</div>`;
  return `<div class="eyebrow">Reference</div><h1>Day-one tasks</h1><h2>Developer</h2>${block("dev", DEV)}<h2>Digital marketing</h2>${block("dm", DM)}${commentsBlock("day1")}`;
}
function vEsc() {
  return `<div class="eyebrow">Reference</div><h1>Escalation, rollback and cadence</h1>
  <div class="tbl"><table><tr><th>Issue</th><th>Immediate action</th><th>Escalate to</th></tr>${ESC.map(r => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</table></div>
  <h2>Governance cadence</h2><div class="list">${[["Daily", "15-minute operational triage: form/event ingestion, platform errors, Zuper exceptions and paid-media continuity."], ["Weekly", "Product sprint review: engineering blockers, asset migration, intent model validation, website UX, app tracking and ad-platform tests. Review new registry items and the consistency check."], ["Monthly", "Steering committee: Head of Commercial Strategy (Franta), Product (Josh), Data (Beryl / Timothy), Finance, CX and Ops. Ikenna receives the monthly summary."], ["Quarterly", "Access and privacy audit; agency ownership and pixel register review; re-verify knowledge base articles."]].map(r => `<div class="row" style="grid-template-columns:90px minmax(0,1fr)"><b>${r[0]}</b><div class="txt">${r[1]}</div></div>`).join("")}</div>${commentsBlock("esc")}`;
}
function vApproval() {
  return `<div class="eyebrow">Sign-off</div><h1>Final approval checklist</h1>
  <div class="list">${APPROVAL.map((a, i) => `<div class="row"><div class="num">${String(i + 1).padStart(2, "0")}</div><div class="txt">${esc(a)}</div><div>${sel("ap-" + (i + 1), CHECK_OPTS)}</div></div>`).join("")}</div>
  ${logBlock("approval", APPROVAL)}${commentsBlock("approval")}`;
}

// ---------- views: search, account, admin ----------
function vSearch() {
  const raw = S.q.trim(), qy = norm(raw);
  if (qy.length < 2) return `<h1>Search</h1><p class="muted">Type at least two characters in the search box: an event name, GTM tag or variable, container ID, Freshsales field, or a word from the guide.</p>`;
  const hl = s => { const t = esc(s); const r = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return r ? t.replace(new RegExp(r, "ig"), m => `<mark>${m}</mark>`) : t; };
  const hit = x => norm(x).includes(qy) || String(x || "").toLowerCase().includes(raw.toLowerCase());
  const F = S.data.fields.filter(f => [f.name, f.description, f.measures, ...(f.aliases || [])].some(hit));
  const I = S.data.impls.filter(i => [i.name, i.label, i.container, i.parent, i.description, i.kind].some(hit));
  const K = S.data.kb.filter(k => [k.title, k.summary, ...(k.steps || [])].some(hit));
  const X = S.data.issues.filter(x => [x.title, x.detail, x.resolution].some(hit));
  const P = []; PB.forEach(p => { if (hit(p.title)) P.push([p, -1, p.title]); p.steps.forEach((s, i) => { if (hit(s)) P.push([p, i, s]); }); });
  const grp = (t, arr, row) => arr.length ? `<h3>${t} (${arr.length})</h3><div class="list">${arr.slice(0, 40).map(row).join("")}</div>` : "";
  const total = F.length + I.length + K.length + X.length + P.length;
  return `<div class="eyebrow">Search</div><h1>Results for "${esc(raw)}"</h1><p class="muted">${total} match${total === 1 ? "" : "es"}</p><div class="hits">
  ${grp("Canonical fields", F, f => `<a class="hit" href="#f-${f.id}"><b>${hl(f.name)}</b> <span class="muted">${esc(f.kind)}</span><small>${hl(f.description)}${(f.aliases || []).length ? " · also known as " + f.aliases.map(hl).join(", ") : ""}</small></a>`)}
  ${grp("Implemented in systems", I, i => { const f = S.A.fieldOf(i.field_id); return `<a class="hit" href="${f ? "#f-" + f.id : "#sys-" + i.system}"><b>${hl(i.name)}</b> <span class="muted">${esc(sysName(i.system))} ${esc(i.kind)}</span><small>${[i.label && hl(i.label), i.container && hl(i.container), f ? "→ " + esc(f.name) : "not mapped", i.description && hl(i.description)].filter(Boolean).join(" · ")}</small></a>`; })}
  ${grp("Knowledge base", K, k => `<a class="hit" href="#kb-${k.id}"><b>${hl(k.title)}</b><small>${hl(k.summary.slice(0, 160))}</small></a>`)}
  ${grp("Playbook steps", P, ([p, i, s]) => `<a class="hit" href="#${p.id}"><b>${p.no}${i >= 0 ? " step " + (i + 1) : ""}</b><small>${hl(s.slice(0, 200))}</small></a>`)}
  ${grp("Problems and fixes", X, x => `<a class="hit" href="#issues"><b>${hl(x.title)}</b> <span class="pill ${x.state === "open" ? "bad" : "ok"}">${x.state}</span><small>${hl((x.resolution || x.detail || "").slice(0, 160))}</small></a>`)}
  ${total ? "" : `<div class="empty">Nothing found. If this is something new, <a href="#add">add it to the registry</a>.</div>`}</div>`;
}
function vPassword(forced) {
  return `<div class="eyebrow">Account</div><h1>${forced ? "Set your own password" : "Change password"}</h1>${forced ? `<p class="muted">You signed in with a temporary password. Choose your own to continue.</p>` : ""}
  <form class="f" data-form="password" style="max-width:420px"><label for="pc">Current password<input id="pc" name="current" type="password" required autocomplete="current-password"></label><label for="pn">New password (10+ characters)<input id="pn" name="next" type="password" required minlength="10" autocomplete="new-password"></label><div class="acts"><button class="btn primary" type="submit">Save password</button></div></form>`;
}
function vAdmin() {
  if (!isAdmin()) return `<h1>Admins only</h1>`;
  if (!S.users) { api("GET", "/api/users").then(u => { S.users = u; render(true); }).catch(e => toast(e.message)); return `<h1>People and access</h1><p class="muted">Loading…</p>`; }
  return `<div class="eyebrow">Admin</div><h1>People and access</h1>
  <p class="muted">Editors can update statuses, the registry, the knowledge base and logs. Viewers can read everything. Admins also manage people.</p>
  ${S.tempPw ? `<div class="box warn"><b>Temporary password for ${esc(S.tempPw.email)}</b><div class="temp">${esc(S.tempPw.pw)}</div><p style="margin:6px 0 0">Send it to them privately (Teams or WhatsApp) with the site address. It is shown only once; they must set their own password at first sign-in.</p><div class="acts"><button class="btn" data-act="copy-pw">Copy</button><button class="btn" data-act="hide-pw">Done</button></div></div>` : ""}
  <form class="f" data-form="invite"><div class="two"><label for="un">Name<input id="un" name="name" required maxlength="100"></label><label for="ue">Email<input id="ue" name="email" type="email" required></label></div><label for="ur">Role<select id="ur" name="role"><option value="editor">Editor</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select></label><div class="acts"><button class="btn primary" type="submit">Add person</button></div></form>
  <div class="tbl" style="margin-top:14px"><table><tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th><th></th></tr>${S.users.map(u => `<tr><td>${esc(u.name)}${u.must_change ? ` <span class="pill warn">first sign-in pending</span>` : ""}</td><td>${esc(u.email)}</td><td><select data-act="role" data-id="${u.id}" aria-label="Role for ${esc(u.name)}" ${u.id === S.me.id ? "disabled" : ""}>${["admin", "editor", "viewer"].map(r => `<option ${r === u.role ? "selected" : ""}>${r}</option>`).join("")}</select></td><td>${u.last_login ? fmtDT(u.last_login) : "Never"}</td><td>${u.id === S.me.id ? "" : `<div class="acts"><button class="btn" data-act="reset" data-id="${u.id}" data-email="${esc(u.email)}">Reset password</button><button class="btn" data-act="user-del" data-id="${u.id}">Remove</button></div>`}</td></tr>`).join("")}</table></div>`;
}
function vActivity() {
  return `<div class="eyebrow">Admin</div><h1>Activity</h1><p class="muted">Every change to the registry, knowledge base and accounts, newest first.</p><div class="feed">${S.data.audit.map(auditHTML).join("") || `<div class="empty">No activity yet.</div>`}</div>`;
}


// ---------- view: import current setup ----------
const HOWTO = {
  freshsales: "Best: the Freshsales fields API (/api/settings/contacts/fields?include=field_group) saved as JSON gives the real field keys; choose 'Freshsales fields API (JSON)'. Quick: Admin Settings > Module customisation > Contacts > Fields, copy the whole layout and paste it. Repeat for Deals and Accounts with the module name in Container.",
  gtm: "Admin > Export container > choose the latest published version > Export. Upload the JSON file here (format: GTM container export). Tags, triggers and variables are imported with what they fire on.",
  ga4: "Admin > Data display > Events: copy the event names (one per line). Repeat with Custom definitions for parameters, choosing type 'event parameter'.",
  firebase: "Firebase console > Analytics > Events, or GA4 Admin for the app stream: copy the event names.",
  amplitude: "Data > Events: export the event list as CSV, then use the CSV format.",
  branch: "Branch dashboard > Events and Integrations: copy event names and connected ad networks (type 'integration').",
  respond: "Workspace Settings > Contact fields: copy the list. Webhooks and workflow steps can be added the same way with the matching type.",
  zuper: "Settings > Custom fields (Jobs, Customers): copy the list. Webhooks: Settings > Developer Hub > Webhooks.",
  meta: "Events Manager > your dataset > Overview: copy the event names. Also record connected partners and integrations.",
  tiktok: "Events Manager > your pixel > Events: copy the event names.",
  gads: "Goals > Conversions > Summary: copy the conversion action names.",
  datalayer: "Ask the web developer for the dataLayer pushes in the site code, one event or key per line."
};
function impRows() { return S.imp?.rows || []; }
function vImport() {
  if (!canWrite()) return `<h1>View-only access</h1><p class="muted">Ask an admin for editor access to import.</p>`;
  const m = S.imp ||= { format: "list", system: "freshsales", container: "", kind: "field", state: "live", fixed: true, text: "", rows: null, result: null };
  const rows = impRows(), A = S.A;
  const existing = new Set(S.data.impls.filter(i => i.system === m.system && i.container === m.container).map(i => i.name.toLowerCase()));
  const chosen = {}; rows.forEach((r, i) => { if (r.on && r.field_id) (chosen[r.field_id] ??= []).push(i); });
  const fieldById = Object.fromEntries(S.data.fields.map(f => [f.id, f]));
  const nOn = rows.filter(r => r.on).length, nMapped = rows.filter(r => r.on && r.field_id).length;
  const stale = m.result ? S.data.impls.filter(i => i.system === m.system && i.container === m.container && i.state !== "deprecated" && !m.result.names.has(i.name.toLowerCase())) : [];
  return `<div class="eyebrow">Data and tracking</div><h1>Import what is already set up</h1>
  <p class="muted">Bring in the fields, events, tags and variables that exist today, system by system. Matching standard fields are suggested; you confirm before anything is saved. Importing the same system and container again updates items instead of duplicating them.</p>
  <form class="f" id="impform">
   <div class="two"><label for="imsys">System<select id="imsys" data-imp="system">${SYSTEMS.map(s => `<option value="${s.id}" ${s.id === m.system ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
   <label for="imfmt">What you are pasting<select id="imfmt" data-imp="format"><option value="list" ${m.format === "list" ? "selected" : ""}>Copied list or field layout (one per line)</option><option value="csv" ${m.format === "csv" ? "selected" : ""}>CSV with a header row</option><option value="gtm" ${m.format === "gtm" ? "selected" : ""}>GTM container export (JSON)</option><option value="freshsales" ${m.format === "freshsales" ? "selected" : ""}>Freshsales fields API (JSON)</option></select></label></div>
   <div class="box info" style="margin:0"><b>Where to get it from ${esc(sysName(m.system))}</b>${esc(HOWTO[m.system] || "Copy the list of names from the tool's settings, one per line.")}${S.data.kb.some(k => k.id === "export-" + m.system) ? ` <a href="#kb-export-${m.system}">Step-by-step export guide</a>` : ""}</div>
   <div class="two"><label for="imcont">Which part of ${esc(sysName(m.system))} is this list from?<input id="imcont" data-imp="container" value="${esc(m.container)}" placeholder="${esc({ freshsales: "e.g. Contacts, Accounts, Deals", gtm: "e.g. GTM-N9XFQZMK (filled in from the export)", ga4: "e.g. the GA4 property name or ID", firebase: "e.g. the Firebase project or app stream", zuper: "e.g. Jobs, Customers", respond: "e.g. Contact fields, Webhooks", meta: "e.g. the dataset (pixel) name", tiktok: "e.g. the pixel name", gads: "e.g. the Google Ads account name" }[m.system] || "e.g. the module, property or account name")}"><span style="font-size:12px">Keeps each list separate, so re-importing Contacts never touches Deals.</span></label>
   <label for="imkind">Type for every item (GTM export sets its own)<input id="imkind" data-imp="kind" list="imkl" value="${esc(m.kind)}"><datalist id="imkl">${(SYS[m.system]?.kinds || []).map(k => `<option value="${esc(k)}">`).join("")}</datalist></label></div>
   <div class="two"><label for="imst">Status<select id="imst" data-imp="state"><option value="live" ${m.state === "live" ? "selected" : ""}>Live (set up today)</option><option value="planned" ${m.state === "planned" ? "selected" : ""}>Planned</option></select></label>
   <label style="display:flex;gap:8px;align-items:center;color:var(--fg);align-self:end"><input type="checkbox" data-imp="fixed" ${m.fixed ? "checked" : ""} style="width:auto"> Names can't be renamed in this system (for example Freshsales field keys)</label></div>
   <label for="imtext">Paste here, or <label for="imfile" style="display:inline;color:var(--info);cursor:pointer;text-decoration:underline">upload a file</label><input id="imfile" type="file" accept=".txt,.csv,.json,text/plain,text/csv,application/json" hidden><textarea id="imtext" data-imp="text" rows="10" placeholder="Contacts&#10;Basic Information&#10;Lead Card&#10;Add field&#10;First name&#10;Mobile&#10;...">${esc(m.text)}</textarea></label>
   <div class="acts"><button class="btn primary" type="button" data-act="imp-preview">Preview</button>${rows.length ? `<button class="btn" type="button" data-act="imp-clear">Start again</button>` : ""}</div>
  </form>
  ${m.result ? `<div class="box ${stale.length ? "warn" : "info"}"><b>Imported into ${esc(sysName(m.system))}${m.container ? " / " + esc(m.container) : ""}</b>${m.result.created} added, ${m.result.updated} updated, ${m.result.replacedPlaceholder} placeholders replaced. <a href="#sys-${m.system}">See everything in ${esc(sysName(m.system))}</a> · <a href="#consistency">Consistency check</a>
   ${stale.length ? `<p style="margin:8px 0 4px">${stale.length} item${stale.length > 1 ? "s" : ""} recorded for ${esc(m.container || "this system")} were not in this import. If they no longer exist, mark them deprecated:</p><div class="chiprow">${stale.map(i => `<label style="display:flex;gap:4px;align-items:center"><input type="checkbox" class="impstale" value="${i.id}" checked style="width:auto"><code>${esc(i.name)}</code></label>`).join("")}</div><div class="acts" style="margin-top:6px"><button class="btn" data-act="imp-deprecate">Mark selected as deprecated</button></div>` : ""}</div>` : ""}
  ${rows.length ? `<h2>Preview: ${rows.length} item${rows.length > 1 ? "s" : ""}${m.container ? " in " + esc(m.container) : ""}</h2>
  <p class="muted">${nOn} selected, ${nMapped} mapped to a standard field. Unmapped items are still recorded; map them later from the consistency check, or create a standard field if they are genuinely new.</p>
  <div class="acts"><button class="btn" data-act="imp-all" data-v="1">Select all</button><button class="btn" data-act="imp-all" data-v="0">Select none</button><button class="btn primary" data-act="imp-save" ${nOn ? "" : "disabled"}>Import ${nOn} item${nOn === 1 ? "" : "s"}</button></div>
  <div class="tbl" style="margin-top:10px"><table><tr><th></th><th>In ${esc(sysName(m.system))}</th><th>Group / fires on</th><th>Type</th><th>Standard field</th><th>Check</th></tr>
  ${rows.map((r, i) => { const f = r.field_id && fieldById[r.field_id]; const notes = [];
    if (existing.has(r.name.toLowerCase())) notes.push(`<span class="pill">updates existing</span>`);
    if (r.on && r.field_id && chosen[r.field_id].length > 1) notes.push(`<span class="pill bad" title="${esc(chosen[r.field_id].map(j => rows[j].label || rows[j].name).join(", "))}">same field as ${chosen[r.field_id].length - 1} other row${chosen[r.field_id].length > 2 ? "s" : ""}</span>`);
    if (f && ((f.pii === "sensitive" && NO_SENSITIVE.includes(m.system)) || (f.pii === "personal" && NO_PERSONAL.includes(m.system)))) notes.push(`<span class="pill bad">${esc(f.pii)} data must not be here</span>`);
    if (r.why) notes.push(`<span class="muted" style="font-size:12px">${esc(r.why)}</span>`);
    return `<tr><td><input type="checkbox" data-imp-on="${i}" ${r.on ? "checked" : ""} aria-label="Include ${esc(r.label || r.name)}" style="width:auto"></td><td><b>${esc(r.label || r.name)}</b>${r.label && r.label !== r.name ? `<div class="by"><code>${esc(r.name)}</code></div>` : ""}</td><td class="muted" style="font-size:12.5px">${esc(r.parent)}</td><td class="muted" style="font-size:12.5px">${esc(r.kind)}</td>
     <td><select data-imp-field="${i}" aria-label="Standard field for ${esc(r.label || r.name)}" style="max-width:220px">${fieldOptions(r.field_id, true)}</select></td><td><div class="chiprow">${notes.join("")}</div></td></tr>`; }).join("")}</table></div>
  <div class="acts" style="margin-top:10px"><button class="btn primary" data-act="imp-save" ${nOn ? "" : "disabled"}>Import ${nOn} item${nOn === 1 ? "" : "s"}</button></div>` : ""}`;
}
function impPreview() {
  const m = S.imp; m.result = null;
  let parsed;
  try {
    parsed = m.format === "freshsales" ? Importer.parseFreshsales(m.text) : m.format === "gtm" ? Importer.parseGTM(m.text) : m.format === "csv" ? Importer.parseCSV(m.text) : /active stages/i.test(m.text) && /lifecycle/i.test(m.text) ? Importer.parseStages(m.text) : Importer.parseList(m.text, { container: m.container, labelsAreNames: !["freshsales", "zuper", "respond", "credit"].includes(m.system) });
  } catch (e) { toast(e.message); return; }
  if (!parsed.items.length) { toast("Nothing recognisable to import. Check the format."); return; }
  if (!m.container && parsed.container) m.container = parsed.container;
  m.rows = parsed.items.map(it => { const s = Importer.suggest(it, S.data.fields); return { ...it, kind: it.kind || m.kind, on: true, field_id: s?.id || "", why: s ? "suggested: " + s.why : "" }; });
}
async function impSave() {
  const m = S.imp, items = m.rows.filter(r => r.on).map(r => ({ system: m.system, container: m.container, kind: r.kind || m.kind, name: r.name, label: r.label || "", parent: r.parent || "", field_id: r.field_id || "", std: m.fixed, state: r.state || m.state, description: r.description || "" }));
  const res = await api("POST", "/api/impls/bulk", { items });
  m.result = { ...res, names: new Set(items.map(i => i.name.toLowerCase())) };
  m.rows = null; m.text = "";
  await load(); render(); scrollTo(0, 0);
}
document.addEventListener("input", e => { const k = e.target.dataset?.imp; if (k && S.imp && k === "text") S.imp.text = e.target.value; });
document.addEventListener("change", e => {
  const el = e.target; if (!S.imp) return;
  if (el.id === "imfile" && el.files[0]) { const r = new FileReader(); r.onload = () => { S.imp.text = String(r.result); if (/\.json$/i.test(el.files[0].name)) S.imp.format = S.imp.system === "freshsales" ? "freshsales" : "gtm"; else if (/\.csv$/i.test(el.files[0].name)) S.imp.format = "csv"; render(true); }; r.readAsText(el.files[0]); return; }
  const k = el.dataset.imp;
  if (k) { S.imp[k] = el.type === "checkbox" ? el.checked : el.value; if (k === "system" || k === "format") { S.imp.rows = null; if (k === "system") { S.imp.kind = SYS[el.value]?.kinds?.[0] || "field"; S.imp.fixed = ["freshsales", "zuper", "respond", "credit", "gads", "meta", "tiktok", "branch"].includes(el.value); } render(true); } return; }
  if (el.dataset.impOn != null) { S.imp.rows[+el.dataset.impOn].on = el.checked; render(true); return; }
  if (el.dataset.impField != null) { const r = S.imp.rows[+el.dataset.impField]; r.field_id = el.value; r.why = el.value ? "chosen" : ""; render(true); }
});
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act^=imp-]"); if (!b || !S.imp) return;
  e.preventDefault();
  const a = b.dataset.act;
  try {
    if (a === "imp-preview") { S.imp.text = $("#imtext").value; S.imp.container = $("#imcont").value; impPreview(); render(true); }
    else if (a === "imp-clear") { S.imp.rows = null; S.imp.result = null; render(true); }
    else if (a === "imp-all") { S.imp.rows.forEach(r => (r.on = b.dataset.v === "1")); render(true); }
    else if (a === "imp-save") { b.disabled = true; await impSave(); toast("Imported"); }
    else if (a === "imp-deprecate") { const ids = [...document.querySelectorAll(".impstale:checked")].map(x => +x.value); if (!ids.length) return; await api("POST", "/api/impls/deprecate", { ids }); S.imp.result = null; await refresh(); toast("Marked deprecated"); }
  } catch (err) { toast(err.message); b.disabled = false; }
});

// ---------- view: settings & connections ----------
function connCard(v) {
  const r = S.connSync?.[v.id], open = S.connOpen === v.id || !v.configured && S.connOpen == null && v.id === "freshsales";
  const status = v.lastTest?.ok && v.configured ? ["ok", "Connected"] : v.manual ? ["ok", "Done: imported"] : !v.configured ? ["", "Not connected"] : v.lastTest?.ok === false ? ["bad", "Last test failed"] : ["warn", "Saved, not tested"];
  const field = f => f.secret
    ? `<label for="c-${v.id}-${f.key}">${esc(f.label)}${f.saved ? ` <span class="pill ok" style="margin-left:4px">saved${f.last4 ? ", ending " + esc(f.last4) : ""}</span>` : ""}${f.type === "textarea" ? `<textarea id="c-${v.id}-${f.key}" name="${f.key}" rows="4" spellcheck="false" placeholder="${f.saved ? "Leave blank to keep the saved key" : "Paste the whole .json file"}"></textarea>` : `<input id="c-${v.id}-${f.key}" name="${f.key}" type="password" autocomplete="new-password" placeholder="${f.saved ? "Leave blank to keep the saved value" : "Paste it here"}">`}${f.help ? `<span style="font-size:12px">${esc(f.help)}</span>` : ""}</label>`
    : `<label for="c-${v.id}-${f.key}">${esc(f.label)}<input id="c-${v.id}-${f.key}" name="${f.key}" value="${esc(f.value)}" placeholder="${esc(f.placeholder)}" autocomplete="off">${f.help ? `<span style="font-size:12px">${esc(f.help)}</span>` : ""}</label>`;
  return `<div class="card" style="padding:16px 20px;margin-top:12px">
   <div style="display:flex;gap:10px;justify-content:space-between;align-items:flex-start"><button class="btn ghost" data-act="conn-open" data-id="${v.id}" style="padding:0;font-size:17px;font-weight:600;flex:1;min-width:0;justify-content:flex-start;text-align:left;white-space:normal;background:none">${icon(open ? "chev-down" : "chev", "sm")} ${esc(v.name)}</button><span class="pill ${status[0]}" style="flex-shrink:0">${status[1]}</span></div>
   <p class="muted" style="margin:6px 0 0">${esc(v.intro)}</p>
   ${v.lastSync ? `<p class="muted" style="font-size:13px;margin:6px 0 0">Last sync ${fmtDT(v.lastSync.at)}: ${v.lastSync.created} added, ${v.lastSync.updated} updated${v.lastSync.logged ? `, ${v.lastSync.logged} problems logged` : ""}${v.lastSync.failed?.length ? `; not synced: ${esc(v.lastSync.failed.join("; "))}` : ""}.</p>` : ""}
   ${open ? `<form class="f" data-form="conn-save" data-id="${v.id}" autocomplete="off" style="margin-top:10px">
    ${v.fields.map(field).join("")}
    <p class="muted" style="font-size:12.5px;margin:0">Keys are stored encrypted and never shown again. Use credentials owned by a Wetility admin account, not a personal or agency one.</p>
    <div class="acts"><button class="btn primary" type="submit">${icon("key", "sm")}Save</button>${v.fields.some(f => f.saved) ? `<button class="btn ghost" type="button" data-act="conn-remove" data-id="${v.id}">Remove keys${v.lastSync ? " (keeps the synced data)" : ""}</button>` : ""}</div>
   </form>` : ""}
   <div class="acts" style="margin-top:10px"><button class="btn" type="button" data-act="conn-test" data-id="${v.id}" ${v.configured ? "" : "disabled"}>${icon("check", "sm")}Test connection</button><button class="btn" type="button" data-act="conn-sync" data-id="${v.id}" ${v.configured ? "" : "disabled"}>${icon("upload", "sm")}Sync now</button></div>
   ${v.manual ? `<p class="by" style="margin:6px 0 0">${icon("check", "sm")} Marked done: ${esc(v.manual.note)} (${esc(v.manual.by || "")}, ${fmtD(v.manual.at)}). <button class="btn ghost sm" data-act="conn-manual" data-id="${v.id}" data-v="0">Undo</button></p>` : `<p class="by" style="margin:6px 0 0"><button class="btn ghost sm" data-act="conn-manual" data-id="${v.id}" data-v="1">Mark as done (imported another way)</button></p>`}
   ${v.configured || v.manual ? "" : `<p class="muted" style="font-size:12.5px;margin:6px 0 0">To test and sync, ${open ? "fill in and save" : "open this card and save"}: <b>${esc((v.missing || []).join(", "))}</b>.</p>`}
   ${v.lastTest && open ? `<div class="box ${v.lastTest.ok ? "ok" : "bad"}"><b>${v.lastTest.ok ? "Connection works" : "Connection failed"}</b>${esc(v.lastTest.message)} <span class="muted" style="font-size:12px">${fmtDT(v.lastTest.at)}</span></div>` : ""}
   ${S.connBusy === v.id ? `<div class="box info"><b>Syncing…</b>Reading configuration from ${esc(v.name)}. This can take a minute.</div>` : ""}
   ${r ? `<h3>Sync result</h3><div class="list">${r.report.map(x => `<div class="row" style="grid-template-columns:24px minmax(0,1fr) auto"><div>${icon(x.ok ? "check" : "x", "sm")}</div><div class="txt"><b>${esc(x.part)}</b>${x.note ? ` <span class="muted">${esc(x.note)}</span>` : ""}${x.ok ? "" : `<div class="by sev-high">${esc(x.error)}</div>`}</div><div class="pill ${x.ok ? "ok" : "bad"}">${x.ok ? x.count + " items" : "failed"}</div></div>`).join("")}</div>
     <p style="margin-top:10px">${r.created} new, ${r.updated} updated in place (your mappings were kept)${r.logged ? `, ${r.logged} new problems logged` : ""}. ${v.systems.map(s => `<a href="#sys-${s}">${esc(sysName(s))}</a>`).join(" · ")} · <a href="#consistency">Consistency check</a></p>
     ${r.stale.length ? `<div class="box warn"><b>${r.stale.length} item${r.stale.length > 1 ? "s" : ""} in the registry no longer exist in ${esc(v.name)}</b><div class="chiprow" style="margin:6px 0">${r.stale.slice(0, 60).map(i => `<label style="display:flex;gap:4px;align-items:center"><input type="checkbox" class="connstale" value="${i.id}" checked style="width:auto"><code>${esc(i.label || i.name)}</code> <span class="muted" style="font-size:12px">${esc(i.container)}</span></label>`).join("")}</div><button class="btn" data-act="conn-deprecate" data-id="${v.id}">Mark selected as deprecated</button></div>` : ""}` : ""}
  </div>`;
}
function vSettings() {
  if (!isAdmin()) return `<h1>Admins only</h1><p class="muted">Ask an admin to manage connections.</p>`;
  if (!S.conns) { api("GET", "/api/connections").then(v => { S.conns = v; render(true); }).catch(e => toast(e.message)); return `<h1>Settings & connections</h1><p class="muted">Loading…</p>`; }
  const n = S.conns.filter(c => c.configured || c.manual).length;
  return `<div class="eyebrow">Admin</div><h1>Settings & connections</h1>
  <p class="lede">Connect the guide to Wetility's systems so the registry refreshes from the source instead of copy-paste. Connections read configuration only (fields, events, tags, ownership), never customer records. ${n} of ${S.conns.length} connected.</p>
  ${S.conns.map(connCard).join("")}
  <div class="card" style="padding:16px 20px;margin-top:12px"><h2 style="margin:0 0 6px">${icon("flow")} Branch.io</h2><p class="muted" style="margin:0">Branch has no API for reading its configuration. Import it from the dashboard export (Tracking → Import current setup).</p></div>`;
}
const connSet = v => { S.conns = S.conns.map(c => c.id === v.id ? v : c); };

// ---------- view: target architecture (start here) ----------
const ARCH_THEMES = [
  ["exposure", "1. Stop the exposure", "This week", "POPIA risk comes before any optimisation.", /bank|consent|id number|id copies|session|recorder|credit score is stored|credit-derived|contact score|sensitive|attachments|privacy|replay|respondio_id/i,
    ["Restrict the bank-detail, ID and credit fields in Freshsales to the roles that need them (Josh, Information Officer).", "Make the Meta tag respect consent instead of 'Consent Granted = True' (agency).", "Keep one session recorder and mask the form fields where people type ID numbers and contact details.", "Information Officer decides whether credit-derived signals (620+, credit approved) may go to ad platforms."],
    "No sensitive field is open to everyone, every tag waits for consent, and the credit-signal decision is written down (gate G1)."],
  ["definition", "2. One lead definition", "Build Nov to Dec, switch from 20 Jan", "Where the money is: Google and Meta bid better on one clean signal.", /lead|key event|conversion|event name|meta receives|enhanced|amplitude project|more than one amplitude|page view|gtm's internal|naming|three different styles|contract sent/i,
    ["Agree the event spine below and the event_id rule (playbook 4.5).", "Website: one lead_submitted event with product as a parameter, fired after the backend accepts the form.", "GA4: generate_lead plus a handful of real key events; everything else stays a normal event.", "Google Ads: one lead conversion. Meta and TikTok: the standard Lead event with event_id.", "Amplitude: one project (89b022e4); retire the others after 30 days without data."],
    "A lead is counted once, with the same ID, in every platform, and the GA4 key events match the spine."],
  ["ownership", "3. Ownership and clean-up", "Alongside", "Wetility owns every account; agencies are partners, not owners.", /own|project|pipeline|clean-up|hidden fields|paused|legacy|duplicate|same facts|shared one|subscription types|web forms|tracking script|product catalogue|probabilit/i,
    ["Confirm Wetility owns the Meta pixel 331051689290488 and TikTok pixel D0ESSGJC77U75NH4NU60 (playbooks 4.2, 4.3).", "Delete the Dark Matter Amplitude project once it is empty and unused.", "Remove the 74 paused GTM tags and the live (TEST) tags after exporting the container.", "Archive the Legacy Wetility Pipeline; set stage probabilities from real conversion rates."],
    "Every pixel, ad account and analytics project sits in a Wetility-owned account, and nothing unused is left running."]
];
const GAP_KIND = { risk: ["bad", "Risk"], decision: ["warn", "Decision"], build: ["sun", "Build"], optimise: ["ok", "Optimise"], cleanup: ["", "Clean-up"] };
function gapsBlock() {
  const done = GAPS.filter(g => st("gap-" + g[0]) === "done").length, label = Object.fromEntries(STEP_OPTS);
  const phases = [...new Set(GAPS.map(g => g[6]))];
  return `<h2 id="a-gaps">${icon("flow")} Gaps to close, in order</h2>
  <p class="muted">Risks first (cheap, nothing blocks them), then the decisions that block the build, then the build, then optimisation; clean-up runs alongside. Thato, the digital marketing specialist starting on 7 November, owns most of the build. Tap a gap for detail and to update it. <b>${done} of ${GAPS.length} closed.</b></p>
  ${phases.map(ph => `<h3 class="gphase">${esc(ph)}</h3><div class="gaps">${GAPS.filter(g => g[6] === ph).map(([id, t, why, who, eff, needs, when, k]) => { const v = st("gap-" + id); return `<details class="card gap${v === "done" ? " done" : ""}" data-open-key="gap-${id}" ${S.secOpen?.["gap-" + id] ? "open" : ""}><summary><span class="gid">${id}</span><b>${esc(t)}</b><span class="pill gst st-${v}">${label[v] || v}</span></summary>
   <div class="gbody"><div class="gm"><span class="pill ${GAP_KIND[k][0]}">${GAP_KIND[k][1]}</span>${needs ? `<span class="pill">Needs ${esc(needs)} first</span>` : ""}</div>
   <p class="by">${esc(why)}</p><p class="by"><b>Owner:</b> ${esc(who)} · <b>Effort:</b> ${esc(eff)}</p><div>${sel("gap-" + id, STEP_OPTS)}</div></div></details>`; }).join("")}</div>`).join("")}`;
}
function accessBlock() {
  const done = ACCESS.filter(x => st("acc-" + x[0]) === "done").length, label = Object.fromEntries(STEP_OPTS);
  return `<details class="asec" id="a-acc" ${S.secOpen?.["a-acc"] ? "open" : ""}><summary><h2>${icon("key")} Access review <span class="muted" style="font:400 14px var(--f-body)">${done} of ${ACCESS.length} platforms done</span></h2></summary>
  <div class="box warn"><b>Remove access without breaking anything</b><ul class="tight">
   <li><b>Remove now:</b> leavers, people nobody recognises, shared logins, and personal or agency-staff accounts invited directly instead of through the agency's partner access.</li>
   <li><b>Reduce, do not remove, during Black Friday:</b> an agency running live campaigns keeps the minimum role it needs (for example Advertiser instead of Admin) until its handover is done.</li>
   <li><b>Before deactivating a user, check what runs on their login:</b> Freshsales API keys, the Kopano social integration, the Power BI connector, Zapier or webhooks stop when their owner is removed.</li>
   <li><b>Every platform:</b> at least two current Wetility admins with two-factor sign-in; agencies through partner access with the least role; every API key or token owned by a Wetility admin or service account with a named owner.</li>
   <li><b>Record each removal</b> in the Implementation log (who, platform, date), so any later problem can be traced to it.</li></ul></div>
  <div class="gaps">${ACCESS.map(([k, name, where, rule]) => { const v = st("acc-" + k); return `<details class="card gap${v === "done" ? " done" : ""}" data-open-key="acc-${k}" ${S.secOpen?.["acc-" + k] ? "open" : ""}><summary><span class="gid">${icon("key", "sm")}</span><b>${esc(name)}</b><span class="pill gst st-${v}">${label[v] || v}</span></summary>
   <div class="gbody"><p class="by"><b>Where to look:</b> ${esc(where)}</p><p class="by"><b>Target:</b> ${esc(rule)}</p><div>${sel("acc-" + k, STEP_OPTS)}</div></div></details>`; }).join("")}</div></details>
`;
}
function actionsBlock(limit) {
  const today = new Date().toISOString().slice(0, 10), label = Object.fromEntries(STEP_OPTS);
  const open = ACTIONS.filter(a => st("act-" + a[0]) !== "done"), done = ACTIONS.length - open.length;
  const byDue = (a, b) => a[1].localeCompare(b[1]);
  const list = limit ? [...open].sort(byDue).slice(0, limit) : [...ACTIONS].sort(byDue);
  const fmt = d => new Date(d + "T12:00:00").toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
  return `<div class="gaps">${list.map(([id, due, t, who, how, gaps]) => { const v = st("act-" + id), late = v !== "done" && due < today;
    return `<details class="card gap act${v === "done" ? " done" : ""}" data-open-key="act-${id}" ${S.secOpen?.["act-" + id] ? "open" : ""}><summary><span class="gid">${id}</span><b>${esc(t)}</b><span class="pill gst st-${v}">${label[v] || v}</span><span class="actmeta"><span class="${late ? "sev-high" : ""}">${late ? "Overdue: " : "Due "}${fmt(due)}</span> · ${esc(who)}</span></summary>
    <div class="gbody"><p class="by">${esc(how)}</p>${gaps ? `<p class="by"><b>Closes:</b> ${esc(gaps)}</p>` : ""}<div>${sel("act-" + id, STEP_OPTS)}</div></div></details>`; }).join("")}</div>
  ${limit ? `<p class="by" style="margin-top:6px">${done} of ${ACTIONS.length} done. <a href="#arch">All actions and owners</a></p>` : ""}`;
}
const SPINE = [
  ["lead_submitted", "Lead submitted", "Website, app or WhatsApp form accepted by the backend", "Browser tag plus server event, same event_id"],
  ["contacted", "Contacted", "First attempted call or consult in Freshsales", "Server event from Freshsales"],
  ["docs_submitted", "Documents submitted", "Credit documents received", "Server event from Freshsales"],
  ["credit_approved", "Credit approved", "Credit decision", "Analytics only until the Information Officer approves"],
  ["contract_signed", "Contract signed", "SignNow contract signed", "Server event, one source (the date field)"],
  ["installed", "Installed", "Zuper job completed and CoC issued", "Server event from Zuper"]
];
function vArch() {
  if (!S.vm) { api("GET", "/api/value-model").then(v => { S.vm = v; render(true); }).catch(e => toast(e.message)); }
  const vm = S.vm, open = S.data.issues.filter(x => x.state === "open"), sevRank = { high: 0, medium: 1, low: 2 };
  const used = new Set(), grouped = ARCH_THEMES.map(t => { const its = open.filter(x => !used.has(x.id) && t[4].test(x.title + " " + (x.detail || ""))); its.forEach(x => used.add(x.id)); return its.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]); });
  const rest = open.filter(x => !used.has(x.id));
  const probRow = k => vm?.stages.find(s => s.key === k)?.p;
  const zar = n => n == null ? "–" : "R" + Math.round(n).toLocaleString("en-ZA");
  const ADS = { yes: ["ok", "Send"], approval: ["bad", "Only with IO approval"], confirm: ["warn", "Confirm with IO"], no: ["", "Do not send"] };
  const cmp = [
    ["Lead definition", "One lead event; product is a parameter", "20 GA4 lead events, about 14 Google Ads conversions, a custom Meta event"],
    ["Conversions", "Only real business outcomes are key events", "About 30 GA4 key events, including logins and clicks"],
    ["Consent", "Tags wait for consent", "Meta tag hard-coded to consent = true; 14 tags on every page"],
    ["Sensitive data", "Minimum data, access restricted", "Bank details, ID number and credit score open in Freshsales"],
    ["Ownership", "Company owns every account; agencies are partners", "Pixels unverified; a Dark Matter Amplitude project; three Amplitude projects"],
    ["Closed loop", "Contract and install sent back to ad platforms, with value", "Events exist in Amplitude but do not reach the ad platforms"],
    ["Values", "Expected value per product and stage, one owned table", "No values on conversions"]
  ];
  return `<div class="eyebrow">Start here</div><h1>Target architecture</h1>
  <p class="lede">Almost every problem in this guide has one root cause: nobody owns a single definition of the customer journey, so each platform, agency and developer tracked it their own way. The fix is to define the journey once and send that same definition everywhere.</p>
  <div class="archnav">${[["a-act", "Actions and owners"], ["a-gaps", "Gaps to close"], ["a-bcp", "Safe transition"], ["a-acc", "Access review"], ["a-spine", "The journey"], ["a-flow", "How data flows"], ["a-cmp", "Best practice vs today"], ["a-pri", "Priorities"], ["a-sig", "Funnel signals"], ["a-val", "Conversion values"], ["a-seq", "What happens when"], ["a-dec", "Decisions needed"]].map(([id, l]) => `<button class="pill" data-act="scrollto" data-t="${id}">${l}</button>`).join("")}</div>
  <h2 id="a-act">${icon("check")} Actions and owners</h2>
  <p class="muted">Who does what next, in date order. Tap an action for detail and to update it. The gaps below explain why.</p>
  ${actionsBlock(0)}
  ${gapsBlock()}
  <details class="asec" id="a-bcp" ${S.secOpen?.["a-bcp"] === false ? "" : "open"}><summary><h2>${icon("shield")} Safe transition and business continuity</h2></summary>
  <div class="box warn"><b>Leads must not drop because of tracking changes</b>The Black Friday offer runs until 19 January. Until then nothing that drives bidding changes: no change to primary conversions, optimisation events or bid strategies. Everything new is built alongside the old setup and only reported. The switch happens after 19 January, one platform at a time, with a rollback ready.</div>
  <div class="cmp">${[
    ["1. Add before you remove", "Every new event, tag and conversion runs next to the old one for at least 2 to 4 weeks. Nothing old is removed until the new one has matched Freshsales for 30 days."],
    ["2. New signals start as secondary", "Google Ads: secondary conversion (reported, not bid on). Meta and TikTok: new standard event on the same pixel, used only by new ad sets. GA4: a key event for reporting."],
    ["3. Freshsales is the source of truth", "Judge every change by leads in Freshsales per day and per source, not by what a platform reports. A platform can report fewer conversions while real leads are unchanged (for example after the consent fix)."],
    ["4. One platform at a time", "Switch Google first, then Meta, then TikTok, at least a week apart, so any drop has one cause."],
    ["5. Do not reset learning on what works", "On Meta and TikTok, change the optimisation event on duplicated ad sets with a share of the budget, then move budget across as they perform. Never edit the event on the best live ad sets."],
    ["6. Every change can be undone in minutes", "GTM: work in a workspace, use Preview, publish as a named version, export the container first; rollback = publish the previous version. Google Ads: switch primary and secondary back. Meta and TikTok: move budget back to the old ad sets."],
    ["7. Change freeze", "No tracking or bidding changes on campaign launch days or in the last week of a promotion, and none from 20 November to 5 December (Black Friday peak) except the risk fixes."]
  ].map(([t, x]) => `<div class="card cmprow" style="grid-template-columns:220px 1fr"><b>${t}</b><div>${x}</div></div>`).join("")}</div>
  <div class="box bad"><b>Rollback triggers (check daily for 14 days after any change)</b><ul class="tight">
   <li>Freshsales leads per day more than 20% below the same weekday's 4-week average for 2 days in a row: roll back the last change the same day.</li>
   <li>A platform's reported conversions fall more than 30% while Freshsales leads hold: it is a tracking fault, not a demand drop; fix or roll back the tag before touching campaigns.</li>
   <li>Cost per Freshsales lead on a platform rises more than 25% for 5 days after a switch: move budget back to the old ad sets or conversion.</li></ul>
   <p class="by" style="margin:6px 0 0"><b>Who:</b> Thato runs the change and the daily check; Franta approves each switch and any rollback; the agency is told 48 hours before every change to campaigns they run.</p></div>
  <div class="box"><b>Before each change, a 5-point check</b><ul class="tight"><li>What changes, on which platform, and is it reported only or used for bidding?</li><li>Baseline for the last 4 weeks noted (Freshsales leads by source, cost per lead).</li><li>Rollback written down and tested (previous GTM version number, old conversion still active).</li><li>Not during a freeze window or a campaign launch.</li><li>Logged in this guide (Implementation log) with the date, so any later drop can be traced to it.</li></ul></div>
  </details>

  ${accessBlock()}
  <h2 id="a-spine">${icon("target")} The journey, defined once</h2>
  <p class="muted">Six events. Same names, same event_id, in every system. The product is a parameter, never part of the name.</p>
  <ol class="spine">${SPINE.map(([k, l, w, how], i) => `<li><span class="sn">${i + 1}</span><div><b>${l}</b><code>${k}</code><div class="by">${w}</div><div class="by"><b>How:</b> ${how}</div></div></li>`).join("")}</ol>

  <details class="asec" id="a-flow" ${S.secOpen?.["a-flow"] ? "open" : ""}><summary><h2>${icon("flow")} How data should flow</h2></summary>
  <div class="flowcols">
   <div class="card fc"><h3>Browser (fast, approximate)</h3><p>Website and app push one dataLayer event per spine step, with event_id and consent state. GTM sends it to GA4, Meta, TikTok and Google Ads.</p></div>
   <div class="card fc"><h3>Server (accurate, complete)</h3><p>Freshsales, Zuper and respond.io send each step to the event ledger with the same event_id and the contract_id. The ledger forwards it to Amplitude and, for approved steps, to Google (Data Manager API), Meta (Conversions API) and TikTok (Events API).</p></div>
  </div>
  <div class="box"><b>Rules that make it work</b><ul class="tight">
   <li>One event per business step; details go in parameters.</li><li>Every event carries an event_id so browser and server copies are deduplicated.</li>
   <li>Click IDs (gclid, gbraid, fbclid, ttclid, ctwa_clid) are captured on the lead and kept on the contact; they are how a sale is tied back to an ad.</li>
   <li>Tags fire only after consent; sensitive data (ID number, bank details, credit score) never reaches GTM, GA4, Amplitude or ad platforms.</li>
   <li>Join systems on contract_id, not phone number alone (decision pending, see below).</li><li>Wetility owns every account; agencies get partner access.</li></ul></div>

  </details>
  <details class="asec" id="a-cmp" ${S.secOpen?.["a-cmp"] ? "open" : ""}><summary><h2>${icon("check")} Best practice vs today</h2></summary>
  <div class="cmp">${cmp.map(([a, bp, now]) => `<div class="card cmprow"><b>${a}</b><div><span class="lbl ok">Best practice</span>${bp}</div><div><span class="lbl bad">Wetility today</span>${now}</div></div>`).join("")}</div>

  </details>
  <details class="asec" id="a-pri" ${S.secOpen?.["a-pri"] ? "open" : ""}><summary><h2>${icon("alert")} The three priorities and their open problems</h2></summary>
  ${ARCH_THEMES.map((t, i) => `<div class="card prio"><div class="ph"><b>${t[1]}</b><span class="pill sun">${t[2]}</span></div><p class="muted">${t[3]}</p>
   <ul class="tight">${t[5].map(x => `<li>${esc(x)}</li>`).join("")}</ul><p class="by"><b>Done when:</b> ${esc(t[6])}</p>
   ${grouped[i].length ? `<details><summary>${grouped[i].length} open problem${grouped[i].length > 1 ? "s" : ""} in this priority</summary>${grouped[i].map(x => `<a class="plink" href="#issues"><span class="sev-${x.severity}">${x.severity}</span> ${esc(x.title)}</a>`).join("")}</details>` : `<p class="by">No open problems in this priority.</p>`}</div>`).join("")}
  ${rest.length ? `<details class="card prio"><summary>${rest.length} other open problem${rest.length > 1 ? "s" : ""}</summary>${rest.map(x => `<a class="plink" href="#issues"><span class="sev-${x.severity}">${x.severity}</span> ${esc(x.title)}</a>`).join("")}</details>` : ""}

  </details>
  <details class="asec" id="a-sig" ${S.secOpen?.["a-sig"] ? "open" : ""}><summary><h2>${icon("chart")} Funnel signals back to the ad platforms</h2></summary>
  <p class="muted">Optimise bidding on the deepest step that still has enough volume, and send the deeper steps as value and for reporting. Meta needs about 50 conversions per ad set per week, TikTok more than about 50 in 14 days; Google copes with fewer, especially with value-based bidding.</p>
  <div class="cmp">${(vm?.stages || []).map((s, i) => { const a = ADS[s.ads] || ADS.yes; return `<div class="card cmprow"><b>${i + 1}. ${esc(s.label)}</b><div><code>${esc(s.key)}</code> <span class="pill ${a[0]}">${a[1]}</span></div></div>`; }).join("")}</div>
  <div class="box"><b>How each step gets back</b><ul class="tight"><li><b>Google:</b> offline conversions through the Data Manager API (mandatory for new offline imports since 15 June 2026), matched on gclid or gbraid plus hashed email and phone.</li><li><b>Meta:</b> Conversions API. Website leads use web CAPI; WhatsApp leads use CAPI for Business Messaging (ctwa_clid, 7-day window).</li><li><b>TikTok:</b> Events API with ttclid.</li><li><b>GA4:</b> Measurement Protocol only accepts events up to 72 hours old, so late steps (contract, install) go to Amplitude and the ad platforms, not GA4.</li></ul><p class="by" style="margin:6px 0 0">Detail and steps: <a href="#pb410">playbook 4.10</a>.</p></div>

  </details>
  <details class="asec" id="a-val" ${S.secOpen?.["a-val"] ? "open" : ""}><summary><h2>${icon("sun")} Conversion values</h2></summary>
  <div class="box info"><b>Value at a step = chance it reaches install × value of an installed customer for that product</b>Use contribution, not subscription revenue: OpCo margin on the system plus FinCo subscription over its life, net of O&amp;M, default and retention costs. Send values in ZAR on every event.</div>
  <ul class="tight"><li><b>Never let the value reveal the credit result.</b> Base values on product, step and region only; a value that jumps after credit approval is itself a credit signal.</li><li><b>One model, owned by Wetility.</b> Agencies use this table; they do not invent values per platform. Review quarterly against actual conversion rates.</li><li><b>Start with values on lead and contacted;</b> switch bidding to value once volume allows. Contract and install values make ROAS reporting honest straight away.</li><li>Do it on the single lead_submitted event, not on today's 20 lead events.</li></ul>
  ${vm ? valueTable(vm, zar) : `<p class="muted">Loading the value table…</p>`}

  </details>
  <details class="asec" id="a-seq" ${S.secOpen?.["a-seq"] ? "open" : ""}><summary><h2>${icon("calendar")} What happens when</h2></summary>
  <ol class="seq">
   <li><b>Now, before 7 November:</b> risk fixes that do not touch bidding (Freshsales field access, Meta consent, credit-signal decision, pixel ownership).</li>
   <li><b>Week of 7 November (Thato starts):</b> baseline and rollback triggers, event spine and join key signed off, value inputs requested, session recording masked.</li>
   <li><b>November to December:</b> build the new setup alongside the old one and report it only. Nothing old is removed and no bidding changes. Freeze from 20 November to 5 December except risk fixes.</li>
   <li><b>December:</b> server events and postbacks sent as secondary conversions, with values, and checked against Freshsales.</li>
   <li><b>From 20 January (after the Black Friday offer ends):</b> switch bidding one platform at a time (Google, then Meta, then TikTok), a week apart, with the rollback triggers watched daily.</li>
   <li><b>From late February:</b> after 30 days of parity, remove the old events, tags and conversions.</li></ol>

  </details>
  <details class="asec" id="a-dec" ${S.secOpen?.["a-dec"] ? "open" : ""}><summary><h2>${icon("gate")} Decisions needed</h2></summary>
  <div class="cmp">${[
    ["Credit-derived signals to ad platforms", "Information Officer", "Can the 620+ or credit-approved signal go to ad platforms, on what legal basis? Until decided, step 4 stays out of any new setup."],
    ["Value of an installed customer per product", "Finance", "Contribution per product (OpCo margin plus FinCo subscription net of costs), for the value table."],
    ["Monthly volumes and conversion rates per step", "Sales operations (Freshsales report)", "Decides which step to optimise on and fills the probabilities."],
    ["Identifier for joining systems", "Josh, Beryl, Timothy", "Move from phone number to contract_id as the canonical join (playbook 4.5)."],
    ["Which Amplitude project is the source of truth", "Franta", "Recommended: 89b022e4, which already holds the funnel."]
  ].map(([d, who, what]) => `<div class="card cmprow"><b>${d}</b><div><span class="lbl">Who</span>${who}</div><div>${what}</div></div>`).join("")}</div></details>`;
}
function valueTable(vm, zar) {
  const edit = canWrite() && S.vmEdit, st = vm.stages;
  if (edit) return `<form class="f card" data-form="vm-save" style="padding:16px">
    <h3 style="margin:0">Edit the value model</h3>
    <p class="by">Probability that a lead at each step becomes an installed customer (0 to 1, for example 0.04), and the value of an installed customer per product in rand.</p>
    <div class="vmgrid">${st.map((s, i) => `<label>${esc(s.label)}<input name="p_${i}" inputmode="decimal" value="${s.p ?? ""}" placeholder="e.g. 0.04"></label>`).join("")}</div>
    <h3 style="margin:10px 0 0">Value of an installed customer (R)</h3>
    <div class="vmgrid">${vm.products.map((p, i) => `<label>${esc(p.name)}<input name="v_${i}" inputmode="numeric" value="${p.value ?? ""}" placeholder="e.g. 40000"><input type="hidden" name="n_${i}" value="${esc(p.name)}"></label>`).join("")}
     <label>Add a product<input name="n_new" placeholder="Product name"></label></div>
    <label>Where the values come from<textarea name="basis" rows="2" placeholder="e.g. Finance model Oct 2026: OpCo margin + FinCo 15-year subscription NPV net of O&M and default">${esc(vm.basis || "")}</textarea></label>
    <div class="acts"><button class="btn primary" type="submit">Save values</button><button class="btn ghost" type="button" data-act="vm-cancel">Cancel</button></div></form>`;
  const filled = vm.products.some(p => p.value != null) && st.some(s => s.p != null);
  return `<div class="card" style="padding:14px 16px">
   <div class="ph"><b>Value table</b>${canWrite() ? `<button class="btn sm" data-act="vm-edit">${filled ? "Edit values" : "Fill in values"}</button>` : ""}</div>
   ${filled ? "" : `<p class="by">Not filled in yet. Needs the installed-customer value per product from finance and the conversion rate per step from Freshsales.</p>`}
   <div class="vmtable">${vm.products.map(p => `<div class="vmrow"><b>${esc(p.name)}</b><span class="by">Installed: ${zar(p.value)}</span><div class="vmcells">${st.map(s => `<span class="vmc"><span class="by">${esc(s.label.split(" (")[0])}</span>${p.value != null && s.p != null ? zar(p.value * s.p) : "–"}</span>`).join("")}</div></div>`).join("")}</div>
   ${vm.basis ? `<p class="by"><b>Basis:</b> ${esc(vm.basis)}</p>` : ""}${vm.updatedAt ? `<p class="by">Last updated ${fmtDT(vm.updatedAt)}${vm.updatedBy ? " by " + esc(vm.updatedBy) : ""}</p>` : ""}</div>`;
}

// ---------- view: more (phone menu) ----------
function vMore() {
  const openI = S.data.issues.filter(x => x.state === "open").length;
  const item = (href, ic, t, sub, extra = "") => `<a class="tile link morei" href="${href}">${icon(ic)}<div class="l"><b>${t}</b>${sub ? `<br>${sub}` : ""}</div>${extra}${icon("chev", "sm go")}</a>`;
  const btn = (act, ic, t) => `<button class="tile link morei" data-act="${act}">${icon(ic)}<div class="l"><b>${t}</b></div>${icon("chev", "sm go")}</button>`;
  return `<h1>More</h1>
  <div class="morelist">${item("#arch", "target", "Target architecture", "Start here: what to fix, in what order, and why")}</div>
  <h3 class="moreh">Knowledge</h3><div class="morelist">${item("#kb", "bulb", "Vendor guidance", "Current step-by-step guides per platform")}${item("#ref", "table", "Schema & naming rules", "How events and fields must be named")}</div>
  <h3 class="moreh">Results</h3><div class="morelist">${item("#issues", "alert", "Problems and fixes", `${openI} open`)}${item("#results", "chart", "Results & KPIs", "Is the implementation delivering?")}${item("#log", "log", "Implementation log", "What was done, when, by whom")}</div>
  ${isAdmin() ? `<h3 class="moreh">Admin</h3><div class="morelist">${item("#settings", "key", "Settings & connections", "API keys and syncs")}${item("#admin", "shield", "People and access", "Invite people, roles")}${item("#activity", "log", "Activity", "Every change, newest first")}</div>` : ""}
  <h3 class="moreh">Account</h3><div class="morelist">${item("#password", "key", "Change password", esc(S.me.email))}${btn("logout", "logout", "Sign out")}</div>`;
}

// ---------- shell ----------
const AREAS = [
  { id: "home", label: "Home", icon: "home", href: "#overview" },
  { id: "plan", label: "Playbooks", icon: "book", href: "#playbooks" },
  { id: "track", label: "Tracking", icon: "radar", href: "#registry" },
  { id: "kb", label: "Knowledge", icon: "bulb", href: "#kb" },
  { id: "results", label: "Results", icon: "chart", href: "#results" }];
function areaOf(h) {
  if (!h || h === "overview") return "home";
  if (["playbooks", "arch", "read", "gates", "ws", "qa", "approval", "day1", "esc"].includes(h) || PB.some(p => p.id === h)) return "plan";
  if (["registry", "consistency", "flow", "import", "add"].includes(h) || h.startsWith("f-") || h.startsWith("sys-")) return "track";
  if (h === "kb" || h.startsWith("kb-") || h === "ref") return "kb";
  if (["results", "log", "issues"].includes(h)) return "results";
  if (["admin", "activity", "password", "settings"].includes(h)) return "admin";
  if (h === "more") return "more";
  return "home";
}
function subnav(area) {
  const openI = S.data.issues.filter(x => x.state === "open").length;
  if (area === "plan") return [["Start", [["arch", "Target architecture"], ["playbooks", "All playbooks"], ["read", "Read this first"], ["gates", "Gates G0–G6"], ["ws", "Workstreams"]]],
    ["Playbooks", PB.map(p => [p.id, p.title, p])], ["Checks", [["qa", "QA test cases"], ["approval", "Final approval"], ["day1", "Day-one tasks"], ["esc", "Escalation & cadence"]]]];
  if (area === "track") return [["Tracking", [["registry", "Registry"], ["consistency", "Consistency check", null, S.A.problems], ["flow", "Data flow"], ["import", "Import current setup"], ["add", "Add one item"]]]];
  if (area === "kb") return [["Knowledge", [["kb", "Vendor guidance"], ["ref", "Schema & naming rules"]]]];
  if (area === "results") return [["Results", [["results", "Results & KPIs"], ["issues", "Problems and fixes", null, openI], ["log", "Implementation log"]]]];
  if (area === "admin") return [["Admin", [["admin", "People and access"], ["settings", "Settings & connections"], ["activity", "Activity"], ["password", "Change password"]]]];
  return [["Shortcuts", [["playbooks", "All playbooks"], ["registry", "Tracking registry"], ["issues", "Problems and fixes", null, openI], ["import", "Import current setup"]]]];
}
function titleOf(h) {
  const p = PB.find(x => x.id === h); if (p) return p.no + " " + p.title;
  if (h.startsWith("f-")) return S.data.fields.find(f => f.id === h.slice(2))?.name || "Field";
  if (h.startsWith("sys-")) return SYS[h.slice(4)]?.name || "System";
  if (h.startsWith("kb-edit-") || h === "kb-new") return "Edit article";
  if (h.startsWith("kb-")) return S.data.kb.find(k => k.id === h.slice(3))?.title || "Article";
  return { overview: "Home", playbooks: "All playbooks", read: "Read this first", gates: "Gates", ws: "Workstreams", qa: "QA test cases", approval: "Final approval", day1: "Day-one tasks", esc: "Escalation & cadence",
    registry: "Tracking registry", consistency: "Consistency check", flow: "Data flow", import: "Import current setup", add: "Add one item", kb: "Vendor guidance", ref: "Schema & naming rules",
    results: "Results & KPIs", log: "Implementation log", issues: "Problems and fixes", search: "Search", settings: "Settings & connections", more: "More", arch: "Target architecture", admin: "People and access", activity: "Activity", password: "Password" }[h] || "Home";
}
const VIEWS = { overview: vOverview, playbooks: vPlaybooks, read: vRead, gates: vGates, ws: vWS, qa: vQA, results: vResults, log: vLog, issues: vIssues, registry: vRegistry, consistency: vConsistency, flow: vFlow, add: vAdd, kb: vKB, ref: vRef, day1: vDay1, esc: vEsc, approval: vApproval, search: vSearch, import: vImport, password: () => vPassword(false), admin: vAdmin, activity: vActivity, settings: vSettings, more: vMore, arch: vArch };
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (S.me?.must_change) return () => vPassword(true);
  if (VIEWS[h]) return VIEWS[h];
  const p = PB.find(x => x.id === h); if (p) return () => vPB(p);
  if (h.startsWith("f-")) return () => vField(h.slice(2));
  if (h.startsWith("sys-")) return () => vSystem(h.slice(4));
  if (h === "kb-new") return () => vKBEdit(null);
  if (h.startsWith("kb-edit-")) return () => vKBEdit(h.slice(8));
  if (h.startsWith("kb-")) return () => vKBArticle(h.slice(3));
  return vOverview;
}
const curKey = () => decodeURIComponent(location.hash.slice(1)) || "overview";
const initials = n => (n || "?").split(/\s+/).map(s => s[0]).slice(0, 2).join("").toUpperCase();
function shell() {
  $("#root").innerHTML = `<div class="app"><aside class="side" aria-label="Main navigation">
   <a class="logo" href="#overview" aria-label="Wetility MarTech Programme home"><img src="/logo-yellow.png" alt="Wetility"><span>MarTech Programme</span></a>
   <nav class="navmain" id="navmain"></nav><nav class="subnav" id="subnav" aria-label="Section"></nav>
   </aside>
  <div class="main"><header class="topbar"><nav class="crumbs" id="crumbs" aria-label="Breadcrumb"></nav>
   <button class="searchbtn" data-act="cmdk" aria-label="Search">${icon("search", "sm")}<span>Search events, fields, guidance</span><kbd>Ctrl K</kbd></button>
   <div class="menuwrap"><button class="avatar" data-act="menu" aria-haspopup="true" aria-label="Account menu">${esc(initials(S.me.name))}</button><div id="menu"></div></div></header>
   <main class="content"><div class="wrap"><nav class="mobsub" id="mobsub" aria-label="Section"></nav><div id="banner"></div><div id="view"></div></div></main></div></div>
  <nav class="bottomnav" id="bottomnav" aria-label="Main"></nav>`;
}
function renderNav() {
  const c = curKey(), area = areaOf(c), openI = S.data.issues.filter(x => x.state === "open").length;
  const areas = [...AREAS, ...(isAdmin() ? [{ id: "admin", label: "Admin", icon: "shield", href: "#admin" }] : [])];
  $("#navmain").innerHTML = areas.map(a => `<a href="${a.href}" class="${a.id === area ? "on" : ""}">${icon(a.icon)}<span>${a.label}</span>${a.id === "results" && openI ? `<span class="badge">${openI}</span>` : a.id === "track" && (S.A.privacy.length + S.A.dups.length) ? `<span class="badge" title="Privacy conflicts and duplicates">${S.A.privacy.length + S.A.dups.length}</span>` : ""}</a>`).join("");
  const groups = subnav(area);
  $("#subnav").innerHTML = groups.map(([h, items]) => `<h5>${h}</h5>` + items.map(([id, l, p, n]) => { const pr = p ? pbProgress(p) : null;
    return `<a href="#${id}" class="${id === c ? "on" : ""}">${p ? `<span class="no">${p.no}</span>` : ""}<span class="t">${esc(l)}</span>${p && isMine(p.owner) ? `<span class="mine" title="Yours"></span>` : ""}${pr ? `<span class="no" style="width:auto">${pr.d}/${pr.n}</span>` : n ? `<span class="badge">${n}</span>` : ""}</a>`; }).join("")).join("");
  // Phone: one compact "where am I / go to" picker instead of rows of chips.
  const mitems = groups.flatMap(([g, items]) => items.map(([id, l, p]) => [id, p ? `${p.no} ${l}` : l, g]));
  const AREA_LABEL = { plan: "Playbooks", track: "Tracking", kb: "Knowledge", results: "Results", admin: "Admin" };
  $("#mobsub").innerHTML = area === "home" || area === "more" || !mitems.length ? "" : `<label class="mobpick"><span>${AREA_LABEL[area] || "Section"}</span><select data-nav="1" aria-label="Go to page in ${AREA_LABEL[area] || "this section"}">${mitems.some(([id]) => id === c) ? "" : `<option value="" selected>${esc(titleOf(c))}</option>`}${groups.map(([g, items]) => `<optgroup label="${esc(g)}">${items.map(([id, l, p]) => `<option value="${id}" ${id === c ? "selected" : ""}>${esc(p ? p.no + " " + l : l)}</option>`).join("")}</optgroup>`).join("")}</select>${icon("chev-down", "sm")}</label>`;
  const bkey = c === "issues" ? "problems" : ["kb", "results", "admin", "more"].includes(area) ? "more" : area;
  $("#bottomnav").innerHTML = [["home", "Home", "home", "#overview"], ["plan", "Playbooks", "book", "#playbooks"], ["track", "Tracking", "radar", "#registry"], ["problems", "Problems", "alert", "#issues"], ["more", "More", "menu", "#more"]]
    .map(([id, l, ic, href]) => `<a href="${href}" class="${id === bkey ? "on" : ""}" ${id === bkey ? 'aria-current="page"' : ""}>${icon(ic, "lg")}<span>${l}</span>${id === "problems" && openI ? `<span class="badge">${openI}</span>` : ""}</a>`).join("");
  const A2 = areas.find(a => a.id === area);
  $("#crumbs").innerHTML = area === "home" && c === "overview" ? `<b>Home</b>` : c === "more" ? `<b>More</b>` : `<a href="${A2?.href || "#overview"}">${A2?.label || "Home"}</a>${icon("chev")}<b>${esc(titleOf(c))}</b>`;
  document.title = titleOf(c) + " · Wetility MarTech";
}
function renderMenu() {
  $("#menu").innerHTML = S.menu ? `<div class="menu" role="menu"><div class="who"><b>${esc(S.me.name)}</b><span>${esc(S.me.email)} · ${esc(S.me.role)}</span></div>
   <label class="mi" for="iam">${icon("user", "sm")}My sections<select id="iam"><option value="">Everyone</option>${PEOPLE.map(n => `<option ${n === filterMe ? "selected" : ""}>${n}</option>`).join("")}</select></label>
   ${isAdmin() ? `<button data-act="go" data-h="settings">${icon("key", "sm")}Settings & connections</button><button data-act="go" data-h="admin">${icon("shield", "sm")}People and access</button>` : ""}
   <button data-act="pw">${icon("key", "sm")}Change password</button><button data-act="logout">${icon("logout", "sm")}Sign out</button></div>` : "";
}
let deferred = false;
function render(keep) {
  const ae = document.activeElement;
  if (keep && ae && ae.closest && ae.closest("#view form.f:not(#impform)") && ae.matches("input,textarea,select")) { deferred = true; return; }
  const y = scrollY, drafts = {};
  document.querySelectorAll("#view form.f textarea, #view form.f input:not([type=checkbox])").forEach(el => { if (el.id && el.value) drafts[el.id] = el.value; });
  const openD = [...document.querySelectorAll("#view details[open]")].map(d => d.querySelector("summary")?.textContent);
  $("#view").innerHTML = route()();
  Object.entries(drafts).forEach(([id, v]) => { const el = document.getElementById(id); if (el && !el.value) el.value = v; });
  document.querySelectorAll("#view details").forEach(d => { if (openD.includes(d.querySelector("summary")?.textContent)) d.open = true; });
  renderNav();
  if (keep) scrollTo(0, y);
}
async function refresh() { await load(); render(true); }

// ---------- login ----------
function loginScreen(msg) {
  $("#root").innerHTML = `<div class="login"><div class="art"><img class="bolt" src="/bolt-black.png" alt="Wetility"><div><span class="brandname">Wetility · MarTech Programme</span><h2>Every signal, owned and accounted for.</h2><p>The implementation guide, tracking registry and vendor guidance for Wetility's MarTech programme.</p>
   <ul><li>${icon("book")}Playbooks with step-by-step status</li><li>${icon("radar")}One registry for every event, tag and field</li><li>${icon("bulb")}Current guidance for every platform</li></ul></div><span></span></div>
  <div class="pane"><form id="login"><div class="eyebrow">Sign in</div><h1>Welcome back</h1>
  <label for="le">Email<input id="le" name="email" type="email" required autocomplete="username"></label><label for="lp">Password<input id="lp" name="password" type="password" required autocomplete="current-password"></label>
  <div class="err" id="lerr">${esc(msg || "")}</div><button class="btn primary" type="submit">Sign in</button><p class="muted" style="font-size:12.5px;margin:0">No account yet? Ask Franta or another admin to add you.</p></form></div></div>`;
  $("#login").addEventListener("submit", async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); const b = e.target.querySelector("button"); b.disabled = true;
    try { await api("POST", "/api/login", d); await start(); } catch (err) { $("#lerr").textContent = err.message; b.disabled = false; } });
}
// ---------- search palette ----------
function cmdkResults(q) {
  const qy = norm(q), raw = q.trim().toLowerCase(), out = [];
  const hit = x => x && (norm(x).includes(qy) || String(x).toLowerCase().includes(raw));
  const pages = [["overview", "Home", "home"], ["playbooks", "All playbooks", "book"], ["registry", "Tracking registry", "table"], ["consistency", "Consistency check", "radar"], ["flow", "Data flow", "flow"], ["import", "Import current setup", "upload"], ["kb", "Vendor guidance", "bulb"], ["results", "Results & KPIs", "chart"], ["issues", "Problems and fixes", "alert"], ["log", "Implementation log", "log"], ["gates", "Gates G0–G6", "gate"], ["read", "Read this first", "alert"]];
  if (!qy) return [{ g: "Go to", items: pages.map(([h, t, i]) => ({ href: "#" + h, t, i })) }];
  const push = (g, arr) => { if (arr.length) out.push({ g, items: arr.slice(0, 6) }); };
  push("Pages", pages.filter(([, t]) => hit(t)).map(([h, t, i]) => ({ href: "#" + h, t, i })));
  push("Playbooks", PB.filter(p => hit(p.title) || hit(p.no)).map(p => ({ href: "#" + p.id, t: p.no + " " + p.title, i: "book" })));
  push("Standard fields", S.data.fields.filter(f => [f.name, f.description, ...(f.aliases || [])].some(hit)).map(f => ({ href: "#f-" + f.id, t: f.name, s: f.description, i: "target" })));
  push("In systems", S.data.impls.filter(i => [i.name, i.label, i.container, i.parent].some(hit)).map(i => { const f = S.A.fieldOf(i.field_id); return { href: f ? "#f-" + f.id : "#sys-" + i.system, t: i.label || i.name, s: `${sysName(i.system)} ${i.kind}${i.container ? " · " + i.container : ""}${f ? " → " + f.name : " · not mapped"}`, i: "table" }; }));
  push("Guidance", S.data.kb.filter(k => [k.title, k.summary].some(hit)).map(k => ({ href: "#kb-" + k.id, t: k.title, s: sysName(k.system), i: "bulb" })));
  const st2 = []; PB.forEach(p => p.steps.forEach((s, i) => { if (hit(s)) st2.push({ href: "#" + p.id, t: `${p.no} step ${i + 1}`, s, i: "check" }); })); push("Steps", st2);
  push("Problems", S.data.issues.filter(x => [x.title, x.detail, x.resolution].some(hit)).map(x => ({ href: "#issues", t: x.title, s: x.state, i: "alert" })));
  return out;
}
function openCmdk() {
  S.cmd = { q: "", sel: 0 };
  let el = $("#cmdk"); if (!el) { el = document.createElement("div"); el.id = "cmdk"; document.body.appendChild(el); }
  el.innerHTML = `<div class="cmdk" data-act="cmdk-close"><div class="box2" role="dialog" aria-label="Search"><div class="in">${icon("search")}<input id="cmdq" placeholder="Search events, GTM tags, fields, guidance, steps…" autocomplete="off"><kbd>Esc</kbd></div><div class="res2" id="cmdres"></div><div class="hint"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><a href="#search" data-act="cmdk-all">See all results</a></span></div></div></div>`;
  drawCmdk(); $("#cmdq").focus();
}
function drawCmdk() {
  const groups = cmdkResults(S.cmd.q); let n = 0;
  const flat = groups.flatMap(g => g.items); S.cmd.flat = flat; S.cmd.sel = Math.min(S.cmd.sel, Math.max(0, flat.length - 1));
  $("#cmdres").innerHTML = flat.length ? groups.map(g => `<div class="grp">${esc(g.g)}</div>` + g.items.map(it => { const k = n++; return `<a class="opt${k === S.cmd.sel ? " sel" : ""}" href="${it.href}" data-k="${k}">${icon(it.i)}<span><b>${esc(it.t)}</b>${it.s ? `<small>${esc(it.s)}</small>` : ""}</span></a>`; }).join("")).join("")
    : `<div class="empty" style="margin:10px">${icon("search")}Nothing found. If it is new, <a href="#add">add it to the registry</a>.</div>`;
}
function closeCmdk() { const el = $("#cmdk"); if (el) el.innerHTML = ""; S.cmd = null; }
document.addEventListener("keydown", e => {
  const typing = /input|textarea|select/i.test(document.activeElement?.tagName || "");
  if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing && !S.cmd)) { if (S.data) { e.preventDefault(); openCmdk(); } return; }
  if (!S.cmd) { if (e.key === "Escape" && S.menu) { S.menu = false; renderMenu(); } return; }
  if (e.key === "Escape") { closeCmdk(); }
  else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); S.cmd.sel = (S.cmd.sel + (e.key === "ArrowDown" ? 1 : -1) + S.cmd.flat.length) % Math.max(1, S.cmd.flat.length); drawCmdk(); $("#cmdres .opt.sel")?.scrollIntoView({ block: "nearest" }); }
  else if (e.key === "Enter") { const it = S.cmd.flat[S.cmd.sel]; if (it) { e.preventDefault(); location.hash = it.href.slice(1); closeCmdk(); } }
});
document.addEventListener("input", e => { if (e.target.id === "cmdq") { S.cmd.q = e.target.value; S.q = e.target.value; S.cmd.sel = 0; drawCmdk(); } });
// ---------- events ----------
document.addEventListener("focusout", () => { if (deferred) setTimeout(() => { const ae = document.activeElement; if (!(ae && ae.closest && ae.closest("#view form.f"))) { deferred = false; render(true); } }, 0); });
addEventListener("hashchange", () => { closeCmdk(); S.menu = false; S.inline = null; if (S.data) { renderMenu(); render(); scrollTo(0, 0); } });
document.addEventListener("input", e => {
  if (e.target.id === "gq") { clearTimeout(S._qt); S._qt = setTimeout(() => { S.q = e.target.value; if (curKey() !== "search") location.hash = "search"; else render(true); }, 200); }
  if (e.target.id === "regq") { clearTimeout(S._rt); S._rt = setTimeout(() => { S.regQ = e.target.value; const pos = e.target.selectionStart; render(); const el = $("#regq"); el.focus(); el.setSelectionRange(pos, pos); }, 200); }
});
document.addEventListener("toggle", e => { const d = e.target; if (!(d instanceof HTMLDetailsElement)) return; const k = d.dataset.openKey || (d.classList.contains("asec") ? d.id : ""); if (k) (S.secOpen ||= {})[k] = d.open; }, true);
document.addEventListener("change", async e => {
  if (e.target.matches("select[data-nav]")) { if (e.target.value) location.hash = e.target.value; return; }
  const el = e.target;
  if (el.id === "pick") { location.hash = el.value; return; }
  if (el.id === "iam" || el.dataset.focus) { filterMe = el.value || null; try { filterMe ? localStorage.setItem("mt_me", filterMe) : localStorage.removeItem("mt_me"); } catch (_) {} render(true); return; }
  if (el.id === "iflt") { S.flag = el.value; render(); return; }
  if (el.id === "regkind") { S.regKind = el.value; render(); return; }
  if (el.id === "regprob") { S.regProb = el.value; render(); return; }
  if (el.name === "system" && el.dataset.kinds) { const dl = document.getElementById(el.dataset.kinds.replace("ik-", "kl-")); if (dl) dl.innerHTML = (SYS[el.value]?.kinds || []).map(k => `<option value="${esc(k)}">`).join(""); const inp = document.getElementById(el.dataset.kinds); if (inp) inp.value = SYS[el.value]?.kinds?.[0] || ""; return; }
  try {
    if (el.classList.contains("state")) { el.dataset.v = el.value; await api("POST", "/api/status", { key: el.dataset.key, state: el.value }); toast("Status saved"); await refresh(); }
    else if (el.dataset.act === "map" && el.value) { await api("PUT", "/api/impls/" + el.dataset.id, { field_id: el.value }); toast("Mapped"); await refresh(); }
    else if (el.dataset.act === "role") { await api("PATCH", "/api/users/" + el.dataset.id, { role: el.value }); S.users = null; toast("Role updated"); render(true); }
  } catch (err) { toast(err.message); }
});
document.addEventListener("submit", async e => {
  const f = e.target.closest("form.f"); if (!f) return; e.preventDefault();
  const fd = new FormData(f), d = Object.fromEntries(fd.entries()), id = f.dataset.id, b = f.querySelector("button[type=submit]"); b.disabled = true;
  try {
    switch (f.dataset.form) {
      case "comment": await api("POST", "/api/comments", { sec: f.dataset.sec, text: d.text }); toast("Comment posted"); break;
      case "log": await api("POST", "/api/logs", { sec: f.dataset.sec, ref: d.ref, date: d.date, text: d.text, evidence: d.evidence }); toast("Implementation recorded"); break;
      case "result": await api("POST", "/api/results", { kpi: f.dataset.kpi, value: d.value, period: d.period, note: d.note }); toast("Measurement recorded"); break;
      case "issue": await api("POST", "/api/issues", { sec: f.dataset.sec, ref: f.dataset.ref || d.ref, title: d.title, detail: d.detail, severity: d.severity }); toast("Problem logged"); break;
      case "resolve": await api("PATCH", "/api/issues/" + id, { state: "resolved", resolution: d.resolution }); toast("Resolved; fix recorded"); break;
      case "kbflag": await api("POST", `/api/kb/${id}/flag`, { note: d.note }); toast("Flagged for review"); break;
      case "kbedit": {
        const slug = id || d.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
        const sources = lines(d.sources).map(l => { const [t, ...u] = l.split("|"); return { title: t.trim(), url: u.join("|").trim() }; });
        await api("PUT", "/api/kb/" + slug, { title: d.title, system: d.system, summary: d.summary, steps: lines(d.steps), practices: lines(d.practices), changes: lines(d.changes), sources, pbs: fd.getAll("pbs") });
        toast("Article saved. Mark it verified once you have checked the sources."); await load(); location.hash = "kb-" + slug; return;
      }
      case "field-new": { const r = await api("POST", "/api/fields", d); toast("Field created"); await load(); location.hash = "f-" + r.id; return; }
      case "field-edit": await api("PUT", "/api/fields/" + id, { ...d, aliases: d.aliases.split(",").map(x => x.trim()).filter(Boolean), expected: fd.getAll("expected") }); toast("Field saved"); break;
      case "merge": await api("POST", `/api/fields/${id}/merge`, { into: d.into }); toast("Merged"); await load(); location.hash = "f-" + d.into; return;
      case "impl": { const body = { ...d, std: fd.has("std") }; if (id) await api("PUT", "/api/impls/" + id, body); else await api("POST", "/api/impls", body); toast(id ? "Saved" : "Added to registry");
        if (!id) { S.prefSys = null; S.prefField = null; await load(); location.hash = d.field_id ? "f-" + d.field_id : "registry"; return; } break; }
      case "vm-save": { const st = S.vm.stages.map((x, i) => ({ ...x, p: d["p_" + i] })); const products = S.vm.products.map((x, i) => ({ name: d["n_" + i], value: d["v_" + i] })); if ((d.n_new || "").trim()) products.push({ name: d.n_new.trim(), value: null });
        S.vm = await api("PUT", "/api/value-model", { stages: st, products, basis: d.basis }); S.vmEdit = false; toast("Values saved"); render(true); return; }
      case "conn-save": { const v = await api("POST", "/api/connections/" + id, d); connSet(v); S.connOpen = id; toast(v.configured ? "Saved. Now click Test connection." : "Saved. Still needed: " + v.missing.join(", ")); render(true); return; }
      case "invite": { const r = await api("POST", "/api/users", d); S.tempPw = { email: r.email, pw: r.tempPassword }; S.users = null; f.reset(); render(true); return; }
      case "password": await api("POST", "/api/password", d); toast("Password saved"); S.me.must_change = false; await load(); location.hash = "overview"; render(); return;
    }
    if (f.classList.contains("inline")) S.inline = null;
    f.reset(); await refresh();
  } catch (err) { toast(err.message); } finally { b.disabled = false; }
});
document.addEventListener("click", async e => {
  if (S.menu && !e.target.closest(".menuwrap")) { S.menu = false; renderMenu(); }
  const b = e.target.closest("[data-act]"); if (!b || b.tagName === "SELECT") return;
  const act = b.dataset.act, id = b.dataset.id;
  if (act === "prefill") { S.prefSys = b.dataset.sys || null; S.prefField = b.dataset.field || null; return; }
  if (act === "cmdk") { openCmdk(); return; }
  if (act === "cmdk-close") { if (e.target.classList.contains("cmdk")) closeCmdk(); return; }
  if (act === "cmdk-all") { closeCmdk(); return; }
  if (act === "menu") { S.menu = !S.menu; renderMenu(); return; }
  if (act === "go") { S.menu = false; renderMenu(); location.hash = b.dataset.h; return; }
  if (act === "scrollto") { const t = document.getElementById(b.dataset.t); if (t instanceof HTMLDetailsElement) t.open = true; t?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (act === "pbtab") { S.pbTab[b.dataset.pb] = b.dataset.tab; S.inline = null; render(true); return; }
  if (act === "inline") { S.inline = S.inline === b.dataset.k ? null : b.dataset.k || null; render(true); setTimeout(() => document.querySelector("#view .inline input:not([type=hidden]), #view .inline textarea")?.focus(), 0); return; }
  if (act === "kbf") { S.kbF = b.dataset.f; render(true); return; }
  if (act === "set-state") { if (!canWrite()) return; const key = b.dataset.key, v = b.dataset.v; S.statusMap[key] = { ...(S.statusMap[key] || {}), state: v, by_user: S.me.id, at: new Date().toISOString() }; render(true);
    try { await api("POST", "/api/status", { key, state: v }); toast({ done: "Marked done", pass: "Marked passed", fail: "Marked failed", blocked: "Marked blocked", progress: "In progress", approved: "Approved", todo: "Status cleared" }[v] || "Saved"); await refresh(); } catch (err) { toast(err.message); await refresh(); } return; }
  const confirmFirst = ["del-comments", "del-logs", "del-results", "del-impl", "user-del", "merge", "reset", "conn-remove"];
  if (confirmFirst.includes(act) && !b.dataset.armed) { b.dataset.armed = "1"; const t = b.textContent; b.textContent = "Click again to confirm"; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = t; } }, 3500); return; }
  try {
    switch (act) {
      case "logout": await api("POST", "/api/logout"); location.hash = ""; return loginScreen("Signed out.");
      case "pw": S.menu = false; renderMenu(); location.hash = "password"; return;
      case "stale": S.showStale = !S.showStale; return render(true);
      case "copy-pw": try { await navigator.clipboard.writeText(S.tempPw.pw); toast("Copied"); } catch (_) { toast("Select the password and copy it"); } return;
      case "hide-pw": S.tempPw = null; return render(true);
      case "del-comments": case "del-logs": case "del-results": await api("DELETE", `/api/${act.slice(4)}/${id}`); toast("Deleted"); break;
      case "del-impl": await api("DELETE", "/api/impls/" + id); toast("Removed from registry"); break;
      case "align": await api("POST", `/api/impls/${id}/align`); toast("Rename requested. Confirm once it is changed in the system."); break;
      case "renamed": await api("POST", `/api/impls/${id}/renamed`); toast("Rename confirmed"); break;
      case "std-on": case "std-off": await api("POST", `/api/impls/${id}/std`, { std: act === "std-on" }); toast("Saved"); break;
      case "merge": await api("POST", `/api/fields/${b.dataset.from}/merge`, { into: b.dataset.into }); toast("Merged"); break;
      case "kb-verify": await api("POST", `/api/kb/${id}/verify`); toast("Marked verified today"); break;
      case "reopen": await api("PATCH", "/api/issues/" + id, { state: "open" }); toast("Reopened"); break;
      case "reset": { const r = await api("PATCH", "/api/users/" + id, { reset: true }); S.tempPw = { email: b.dataset.email, pw: r.tempPassword }; S.users = null; return render(true); }
      case "user-del": await api("DELETE", "/api/users/" + id); S.users = null; toast("Removed"); break;
      case "vm-edit": S.vmEdit = true; return render(true);
      case "vm-cancel": S.vmEdit = false; return render(true);
      case "conn-manual": connSet(await api("POST", `/api/connections/${id}/manual`, { done: b.dataset.v === "1" })); toast(b.dataset.v === "1" ? "Marked done" : "Unmarked"); return render(true);
      case "conn-open": S.connOpen = S.connOpen === id ? "" : id; return render(true);
      case "conn-test": b.disabled = true; { const v = await api("POST", `/api/connections/${id}/test`); connSet(v); toast(v.lastTest?.ok ? "Connection works" : "Connection failed"); } return render(true);
      case "conn-remove": connSet(await api("DELETE", "/api/connections/" + id)); if (S.connSync) delete S.connSync[id]; toast("Keys removed"); return render(true);
      case "conn-sync": S.connBusy = id; render(true); try { const r = await api("POST", `/api/connections/${id}/sync`); (S.connSync ||= {})[id] = r; connSet(r.connection); toast("Synced"); } finally { S.connBusy = null; } await refresh(); return;
      case "conn-deprecate": { const ids = [...document.querySelectorAll(".connstale:checked")].map(x => +x.value); if (!ids.length) return; await api("POST", "/api/impls/deprecate", { ids }); S.connSync[id].stale = S.connSync[id].stale.filter(i => !ids.includes(i.id)); toast("Marked deprecated"); break; }
      default: return;
    }
    await refresh();
  } catch (err) { toast(err.message); }
});

// ---------- boot ----------
async function start() {
  try { await load(); } catch (e) { if (e.status === 401) return loginScreen(); $("#root").innerHTML = `<div class="login"><div class="box bad"><b>Could not load the guide</b>${esc(e.message)}</div></div>`; return; }
  shell(); render();
  clearInterval(S._poll); S._poll = setInterval(() => { if (!document.hidden) refresh().catch(err => { if (err.status === 401) loginScreen("Your session ended. Sign in again."); }); }, 30000);
}
start();
})();
