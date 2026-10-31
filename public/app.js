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
const sysName = id => SYS[id]?.short || (id === "governance" ? "Governance" : id);
const STEP_OPTS = [["todo", "Not started"], ["progress", "In progress"], ["done", "Done"], ["blocked", "Blocked"]];
const TEST_OPTS = [["todo", "Not run"], ["pass", "Pass"], ["fail", "Fail"]];
const GATE_OPTS = [["todo", "Pending"], ["progress", "In review"], ["approved", "Approved"], ["blocked", "Blocked"]];
const CHECK_OPTS = [["todo", "Open"], ["done", "Done"]];
const CODE_LABEL = { consistent: "Consistent", platform: "Platform-required name", differs: "Name differs", old: "Uses an old name", pending: "Rename pending", unconfirmed: "Name to confirm", unmapped: "Not mapped", deprecated: "Deprecated" };

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
  const dups = Object.values(g).filter(a => a.length > 1);
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
function sel(key, opts) {
  const v = st(key), r = S.statusMap[key];
  return `<select class="state" data-key="${key}" data-v="${v}" aria-label="Status" ${canWrite() ? "" : "disabled"}>${opts.map(([k, l]) => `<option value="${k}" ${k === v ? "selected" : ""}>${l}</option>`).join("")}</select>${r ? `<div class="by">${esc(nameOf(r.by_user))} · ${fmtD(r.at)}</div>` : ""}`;
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
function vOverview() {
  const all = PB.reduce((a, p) => { const r = pbProgress(p); a.d += r.d; a.b += r.b; a.n += r.n; return a; }, { d: 0, b: 0, n: 0 });
  const gatesOk = GATES.filter(g => st("gate-" + g[0]) === "approved").length;
  const qaPass = QA.filter(q => st("qa-" + q[0]) === "pass").length, qaFail = QA.filter(q => st("qa-" + q[0]) === "fail");
  const openIssues = S.data.issues.filter(x => x.state === "open");
  const A = S.A;
  const blocked = []; PB.forEach(p => p.steps.forEach((s, i) => { if (st(`${p.id}-s${i + 1}`) === "blocked") blocked.push([p, i, s]); }));
  const kOff = KPIS.filter(k => { const h = S.data.results.filter(r => r.kpi === k.id); if (!h.length || k.target == null) return false; const v = Number(h.at(-1).value); return !(k.dir === "min" ? v >= k.target : v <= k.target); });
  const att = [
    ...(st("gate-G1") !== "approved" ? [`<div class="box bad"><b>Live exposure check: 620+ credit signal to ad platforms</b>G1 privacy is not yet approved. Confirm Information Officer / Legal sign-off for the threshold signal by 7 Nov 2026. <a href="#read">Details</a></div>`] : []),
    ...(A.privacy.length ? [`<div class="box bad"><b>${A.privacy.length} privacy conflict${A.privacy.length > 1 ? "s" : ""} in the tracking registry</b>Sensitive or personal data recorded in a system where it must not appear. <a href="#consistency">Review</a></div>`] : []),
    ...(A.dups.length ? [`<div class="box warn"><b>${A.dups.length} duplicate implementation${A.dups.length > 1 ? "s" : ""}</b>The same event or field is implemented more than once in one system. <a href="#consistency">Review</a></div>`] : []),
    ...openIssues.filter(x => x.severity === "high").map(x => `<div class="box warn"><b>High-severity problem: ${esc(x.title)}</b><a href="#issues">Open issues</a></div>`),
    ...blocked.map(([p, i, s]) => `<div class="box warn"><b>Blocked: ${p.no} step ${i + 1}</b>${esc(s.slice(0, 140))}${s.length > 140 ? "…" : ""} <a href="#${p.id}">Open</a></div>`),
    ...qaFail.map(q => `<div class="box warn"><b>Test failed: ${q[0]}</b>${esc(q[1])} <a href="#qa">Open</a></div>`),
    ...kOff.map(k => `<div class="box warn"><b>Off target: ${esc(k.name)}</b><a href="#results">Open</a></div>`)];
  return `<div class="eyebrow">Programme overview</div><h1>Is the MarTech programme on track?</h1>
  <p class="muted">Ownership, integrity, identity and conversion signals across the website, app, WhatsApp, CRM, field operations, analytics and ad platforms.</p>
  <div class="tiles">
   <div class="tile"><div class="n">${all.d}/${all.n}</div><div class="l">Playbook steps done</div></div>
   <div class="tile"><div class="n">${gatesOk}/7</div><div class="l">Gates approved</div></div>
   <div class="tile"><div class="n">${qaPass}/${QA.length}</div><div class="l">QA tests passed</div></div>
   <div class="tile"><div class="n">${openIssues.length}</div><div class="l">Open problems</div></div>
   <div class="tile"><div class="n">${A.score == null ? "–" : A.score + "%"}</div><div class="l">Tracking names consistent</div></div></div>
  <h2>Needs attention</h2>${att.length ? att.join("") : `<div class="empty">Nothing blocked, failed, conflicting or off target.</div>`}
  <h2>Workstreams</h2><div class="list">${WS.map(w => { const ps = w[4].map(id => PB.find(p => p.id === id)); const pr = ps.reduce((a, p) => { const r = pbProgress(p); a.d += r.d; a.b += r.b; a.g += r.g; a.n += r.n; return a; }, { d: 0, b: 0, g: 0, n: 0 });
    return `<div class="row"><div class="num">WS${w[0]}</div><div class="txt"><b>${esc(w[1])}</b><div class="by">${esc(w[2])} · ${esc(w[3])}</div><div style="margin-top:6px">${bar(pr)}</div><div class="by">${ps.map(p => `<a href="#${p.id}">${p.no}</a>`).join(" · ")}</div></div><div class="pill ${pr.b ? "bad" : pr.d === pr.n ? "ok" : pr.d || pr.g ? "warn" : ""}">${pr.d}/${pr.n}</div></div>`; }).join("")}</div>
  <h2>Latest implementation entries</h2><div class="feed">${S.data.logs.length ? S.data.logs.slice(0, 5).map(entryHTML).join("") : `<div class="empty">No implementation recorded yet. Open a playbook and use "Record implementation".</div>`}</div>`;
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
function vPB(p) {
  const pr = pbProgress(p), refs = [...p.steps.map((s, i) => `Step ${i + 1}: ${s.slice(0, 60)}${s.length > 60 ? "…" : ""}`), ...p.tests.map((t, i) => `Test A${i + 1}`), "General"];
  return `<div class="eyebrow">Playbook ${p.no} · Workstream ${p.ws}</div><h1>${esc(p.title)}</h1>
  <dl class="meta"><div><dt>Objective</dt><dd>${esc(p.obj)}</dd></div><div><dt>Owner</dt><dd>${esc(p.owner)}</dd></div><div><dt>Prerequisites</dt><dd>${esc(p.pre)}</dd></div></dl>
  ${p.note ? `<div class="box warn"><b>Before you start</b>${esc(p.note)}</div>` : ""}
  <div class="acts" style="margin:6px 0 4px"><div style="flex:1;min-width:160px">${bar(pr)}</div><span class="muted" style="font-size:13px">${pr.d} of ${pr.n} steps done${pr.b ? `, ${pr.b} blocked` : ""}</span></div>
  <h2>Procedure</h2><div class="list">${p.steps.map((s, i) => `<div class="row"><div class="num">${String(i + 1).padStart(2, "0")}</div><div class="txt">${esc(s)}</div><div>${sel(`${p.id}-s${i + 1}`, STEP_OPTS)}</div></div>`).join("")}</div>
  <h2>Acceptance tests</h2><div class="list">${p.tests.map((t, i) => `<div class="row"><div class="num">A${i + 1}</div><div class="txt">${esc(t)}</div><div>${sel(`${p.id}-t${i + 1}`, TEST_OPTS)}</div></div>`).join("")}</div>
  ${p.avoid ? `<h3>Avoid</h3><div class="avoid">${esc(p.avoid)}</div>` : ""}
  ${kbPanel(p.id)}
  ${p.kpis.length ? `<h2>Is it delivering?</h2><div class="grid2">${p.kpis.map(id => kpiCard(KPIS.find(k => k.id === id))).join("")}</div>` : ""}
  ${logBlock(p.id, refs)}${issueBlock(p.id, refs)}${commentsBlock(p.id)}`;
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
  <div class="tiles"><div class="tile"><div class="n">${S.data.fields.filter(f => f.status !== "deprecated").length}</div><div class="l">Canonical fields</div></div><div class="tile"><div class="n">${S.data.impls.length}</div><div class="l">Items across systems</div></div><div class="tile"><div class="n">${A.score == null ? "–" : A.score + "%"}</div><div class="l">Names consistent</div></div><div class="tile"><div class="n">${A.problems}</div><div class="l"><a href="#consistency">Problems to fix</a></div></div></div>
  <div class="filters"><input id="regq" type="search" placeholder="Filter by name, alias, GTM label or container" value="${esc(S.regQ || "")}" aria-label="Filter registry">
   <select id="regkind" aria-label="Type"><option value="">All types</option>${["event", "identifier", "parameter", "attribute"].map(k => `<option ${kind === k ? "selected" : ""}>${k}</option>`).join("")}</select>
   <select id="regprob" aria-label="Problems"><option value="">All fields</option><option value="1" ${prob ? "selected" : ""}>Only fields with problems</option></select>
   ${canWrite() ? `<a class="btn primary" href="#add">Add item or field</a>` : ""}<a class="btn" href="/api/export/registry.csv">Download CSV</a></div>
  <div class="legend"><span><span class="cell c-consistent">name</span>Consistent</span><span><span class="cell c-platform">name</span>Platform-required name</span><span><span class="cell c-differs">name</span>Name differs</span><span><span class="cell c-pending">name</span>Rename pending</span><span><span class="cell c-unconfirmed">name</span>To confirm</span><span><span class="cell c-dup">name</span>Duplicate</span><span><span class="cell c-privacy">name</span>Privacy conflict</span><span><span class="cell c-missing">missing</span>Expected, not recorded</span></div>
  <div class="tbl"><table class="regtbl"><tr><th rowspan="2">Canonical field</th>${layerCounts.map(([l, n]) => `<th class="layer" colspan="${n}">${l}</th>`).join("")}</tr><tr>${SYSTEMS.map(s => `<th><a href="#sys-${s.id}">${esc(s.short)}</a></th>`).join("")}</tr>
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
    ["differs", "old", "pending"].includes(c) ? `<button class="btn" data-act="std-on" data-id="${i.id}" title="The platform requires this exact name, so it cannot be changed">Platform requires this name</button>` : "",
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
  const sec = (title, why, items, row) => `<h2>${title} <span class="muted" style="font:400 14px var(--f-body)">${items.length}</span></h2><p class="muted">${why}</p>${items.length ? items.map(row).join("") : `<div class="empty">None.</div>`}`;
  const implLine = (i, extra = "") => { const f = A.fieldOf(i.field_id); return `<div class="impl"><div class="t"><b>${esc(sysName(i.system))}</b><span class="muted">${esc(i.kind)}</span>${chip(i)}${f ? `<span class="muted">→</span><a href="#f-${f.id}"><code>${esc(f.name)}</code></a>` : ""}${i.label ? `<span class="muted" style="font-size:12.5px">${esc(i.label)}</span>` : ""}</div>${extra}</div>`; };
  const acts = i => canWrite() ? `<div class="acts">${A.code[i.id] === "pending" ? `<button class="btn primary" data-act="renamed" data-id="${i.id}">Renamed in ${esc(sysName(i.system))}</button>` : `<button class="btn" data-act="align" data-id="${i.id}">Align to canonical</button>`}<button class="btn" data-act="std-on" data-id="${i.id}">Platform requires this name</button></div>` : "";
  return `<div class="eyebrow">Data and tracking</div><h1>Consistency check</h1>
  <p class="muted">Recalculated from the registry every time it changes. Work top to bottom: privacy first, then duplicates, then names.</p>
  <div class="tiles"><div class="tile"><div class="n">${A.score == null ? "–" : A.score + "%"}</div><div class="l">Names consistent (mapped items)</div></div><div class="tile"><div class="n">${A.privacy.length}</div><div class="l">Privacy conflicts</div></div><div class="tile"><div class="n">${A.dups.length + A.collisions.length + A.similar.length}</div><div class="l">Duplicates</div></div><div class="tile"><div class="n">${A.naming.length + A.pending.length}</div><div class="l">Names to align</div></div><div class="tile"><div class="n">${A.missing.length}</div><div class="l">Gaps</div></div></div>
  ${sec("Privacy conflicts", "Data classed as sensitive or personal recorded in a browser, analytics or ad-platform system. Fix or get Information Officer approval.", A.privacy, i => implLine(i, `<div class="muted" style="font-size:13px">${esc(i.description)}</div>`))}
  ${sec("Duplicate implementations", "The same event or field implemented more than once in one system. Usually double-counting; keep one.", A.dups, g => `<div class="box warn">${g.map(i => implLine(i)).join("")}</div>`)}
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
  <div class="flowwrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Data flow between Wetility systems"><defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--muted)"/></marker></defs>${heads}${edges}${nodes}</svg></div>
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
  const stale = S.data.kb.filter(k => k.review_flag || !k.verified_on || (Date.now() - new Date(k.verified_on)) / 864e5 > 90);
  const groups = {}; S.data.kb.forEach(k => { (groups[k.system] ??= []).push(k); });
  return `<div class="eyebrow">Knowledge base</div><h1>Current vendor guidance</h1>
  <p class="muted">Step-by-step guidance for each platform, with sources and the date it was last checked. Articles older than 90 days are marked for review. When vendor docs change, edit the article and mark it verified.</p>
  <div class="acts">${canWrite() ? `<a class="btn primary" href="#kb-new">New article</a>` : ""}<button class="btn" data-act="stale">Show what needs re-checking (${stale.length})</button></div>
  ${S.showStale ? `<div class="box warn" style="margin-top:12px"><b>${stale.length} article${stale.length === 1 ? "" : "s"} to re-check</b>${stale.length ? `<ul style="margin:6px 0 0;padding-left:18px">${stale.map(k => `<li><a href="#kb-${k.id}">${esc(k.title)}</a>: ${k.review_flag ? "flagged" + (k.review_note ? ` (${esc(k.review_note)})` : "") : !k.verified_on ? "never verified" : "verified " + fmtD(k.verified_on)}. Sources: ${(k.sources || []).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(", ")}</li>`).join("")}</ul>` : "All articles verified within 90 days."}</div>` : ""}
  ${Object.entries(groups).sort((a, b) => sysName(a[0]).localeCompare(sysName(b[0]))).map(([sys, arts]) => `<h2>${esc(sysName(sys))}</h2><div class="feed">${arts.map(k => `<a class="entry" href="#kb-${k.id}" style="text-decoration:none;color:inherit;display:block"><div class="h"><b>${esc(k.title)}</b>${kbBadge(k)}</div><p class="muted">${esc(k.summary.slice(0, 220))}${k.summary.length > 220 ? "…" : ""}</p></a>`).join("")}</div>`).join("")}`;
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
  <div class="two"><label for="kt">Title<input id="kt" name="title" required maxlength="200" value="${esc(k.title)}"></label><label for="ks">System<select id="ks" name="system">${[...SYSTEMS, { id: "governance", name: "Governance and privacy" }].map(s => `<option value="${s.id}" ${s.id === k.system ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label></div>
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

// ---------- shell ----------
const NAV = () => [
  ["Start", [["overview", "Programme overview"], ["read", "Read this first"], ["gates", "Gates G0–G6"], ["ws", "Workstreams"]]],
  ["Playbooks", PB.map(p => [p.id, p.no + " " + p.title])],
  ["Data and tracking", [["registry", "Tracking registry"], ["consistency", "Consistency check", S.A.problems], ["flow", "Data flow"], ["add", "Add to registry"]]],
  ["Knowledge base", [["kb", "Vendor guidance"]]],
  ["Prove it works", [["qa", "QA test cases"], ["results", "Results & KPIs"], ["log", "Implementation log"], ["issues", "Problems and fixes", S.data.issues.filter(x => x.state === "open").length]]],
  ["Reference", [["ref", "Schema and naming rules"], ["day1", "Day-one tasks"], ["esc", "Escalation & cadence"], ["approval", "Final approval checklist"]]],
  ...(isAdmin() ? [["Admin", [["admin", "People and access"], ["activity", "Activity"]]]] : [])];
const VIEWS = { overview: vOverview, read: vRead, gates: vGates, ws: vWS, qa: vQA, results: vResults, log: vLog, issues: vIssues, registry: vRegistry, consistency: vConsistency, flow: vFlow, add: vAdd, kb: vKB, ref: vRef, day1: vDay1, esc: vEsc, approval: vApproval, search: vSearch, password: () => vPassword(false), admin: vAdmin, activity: vActivity };
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
const curKey = () => location.hash.slice(1) || "overview";
function shell() {
  $("#root").innerHTML = `<header class="top"><div class="brand"><b>MarTech Programme</b><span>Wetility · Implementation guide</span></div>
  <div class="search"><input id="gq" type="search" placeholder="Search events, tags, variables, fields, guidance" aria-label="Search" value="${esc(S.q)}"></div>
  <div class="who"><span class="dot" aria-hidden="true">${esc((S.me.name || "?").split(/\s+/).map(s => s[0]).slice(0, 2).join("").toUpperCase())}</span><span>${esc(S.me.name)} <span style="color:#AFC0D8">(${esc(S.me.role)})</span></span>
  <label for="iam" style="color:#AFC0D8">My sections</label><select id="iam"><option value="">Everyone</option>${PEOPLE.map(n => `<option ${n === filterMe ? "selected" : ""}>${n}</option>`).join("")}</select>
  <button data-act="pw">Password</button><button data-act="logout">Sign out</button></div></header>
  <div class="shell"><nav class="rail" id="rail" aria-label="Sections"></nav><main><div class="wrap"><div class="picker"><label for="pick" class="muted" style="font-size:12px">Section</label><select id="pick"></select></div><div id="view"></div></div></main></div>`;
}
function renderNav() {
  const c = curKey(), nav = NAV();
  $("#rail").innerHTML = nav.map(([h, items]) => `<h4>${h}</h4>` + items.map(([id, l, n]) => { const p = PB.find(x => x.id === id), pr = p ? pbProgress(p) : null;
    return `<a href="#${id}" class="${id === c ? "on" : ""}">${p && isMine(p.owner) ? `<span class="mine" title="Your section"></span>` : ""}<span style="flex:1;min-width:0">${esc(l)}</span>${pr ? `<small>${pr.d}/${pr.n}</small>` : n ? `<small class="sev-high">${n}</small>` : ""}</a>`; }).join("")).join("");
  $("#pick").innerHTML = nav.map(([h, items]) => `<optgroup label="${h}">${items.map(([id, l]) => `<option value="${id}" ${id === c ? "selected" : ""}>${esc(l)}</option>`).join("")}</optgroup>`).join("");
}
let deferred = false;
function render(keep) {
  const ae = document.activeElement;
  if (keep && ae && ae.closest && ae.closest("#view form.f") && ae.matches("input,textarea,select")) { deferred = true; return; }
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
  $("#root").innerHTML = `<div class="login"><form id="login"><div class="eyebrow">Wetility</div><h1>MarTech Programme</h1><p class="muted" style="margin:0">Implementation guide, tracking registry and vendor guidance.</p>
  <label for="le">Email<input id="le" name="email" type="email" required autocomplete="username"></label><label for="lp">Password<input id="lp" name="password" type="password" required autocomplete="current-password"></label>
  <div class="err" id="lerr">${esc(msg || "")}</div><button class="btn primary" type="submit">Sign in</button><p class="muted" style="font-size:12.5px;margin:0">No account? Ask Franta or another admin to add you.</p></form></div>`;
  $("#login").addEventListener("submit", async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); const b = e.target.querySelector("button"); b.disabled = true;
    try { await api("POST", "/api/login", d); await start(); } catch (err) { $("#lerr").textContent = err.message; b.disabled = false; } });
}

// ---------- events ----------
document.addEventListener("focusout", () => { if (deferred) setTimeout(() => { const ae = document.activeElement; if (!(ae && ae.closest && ae.closest("#view form.f"))) { deferred = false; render(true); } }, 0); });
addEventListener("hashchange", () => { if (S.data) { render(); scrollTo(0, 0); } });
document.addEventListener("input", e => {
  if (e.target.id === "gq") { clearTimeout(S._qt); S._qt = setTimeout(() => { S.q = e.target.value; if (curKey() !== "search") location.hash = "search"; else render(true); }, 200); }
  if (e.target.id === "regq") { clearTimeout(S._rt); S._rt = setTimeout(() => { S.regQ = e.target.value; const pos = e.target.selectionStart; render(); const el = $("#regq"); el.focus(); el.setSelectionRange(pos, pos); }, 200); }
});
document.addEventListener("change", async e => {
  const el = e.target;
  if (el.id === "pick") { location.hash = el.value; return; }
  if (el.id === "iam") { filterMe = el.value || null; try { filterMe ? localStorage.setItem("mt_me", filterMe) : localStorage.removeItem("mt_me"); } catch (_) {} renderNav(); return; }
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
      case "invite": { const r = await api("POST", "/api/users", d); S.tempPw = { email: r.email, pw: r.tempPassword }; S.users = null; f.reset(); render(true); return; }
      case "password": await api("POST", "/api/password", d); toast("Password saved"); S.me.must_change = false; await load(); location.hash = "overview"; render(); return;
    }
    f.reset(); await refresh();
  } catch (err) { toast(err.message); } finally { b.disabled = false; }
});
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b || b.tagName === "SELECT") return;
  const act = b.dataset.act, id = b.dataset.id;
  if (act === "prefill") { S.prefSys = b.dataset.sys || null; S.prefField = b.dataset.field || null; return; }
  const confirmFirst = ["del-comments", "del-logs", "del-results", "del-impl", "user-del", "merge", "reset"];
  if (confirmFirst.includes(act) && !b.dataset.armed) { b.dataset.armed = "1"; const t = b.textContent; b.textContent = "Click again to confirm"; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = t; } }, 3500); return; }
  try {
    switch (act) {
      case "logout": await api("POST", "/api/logout"); location.hash = ""; return loginScreen("Signed out.");
      case "pw": location.hash = "password"; return;
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
