const path = require("path");
const crypto = require("crypto");
const express = require("express");
const compression = require("compression");
const session = require("express-session");
const PgStore = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const { pool, init, q } = require("./db");
const { seed, seedV2, ensureAdmin } = require("./seed");
const { seedV3 } = require("./seed_v3");
const { seedV4 } = require("./seed_v4");
const { seedV5 } = require("./seed_v5");
const { seedV6 } = require("./seed_v6");
const { seedV7 } = require("./seed_v7");
const { seedV8 } = require("./seed_v8");
const { seedV9 } = require("./seed_v9");
const { seedV10 } = require("./seed_v10");
const { seedV11 } = require("./seed_v11");
const { seedV12 } = require("./seed_v12");
const { seedV13 } = require("./seed_v13");
const { seedV14 } = require("./seed_v14");
const { seedV15 } = require("./seed_v15");
const { seedV16 } = require("./seed_v16");
const { seedV17 } = require("./seed_v17");
const { seedV18 } = require("./seed_v18");
const { seedV19 } = require("./seed_v19");
const { seedV20 } = require("./seed_v20");
const { seedV21 } = require("./seed_v21");
const { seedV22 } = require("./seed_v22");
const { seedV23 } = require("./seed_v23");
const { seedV24 } = require("./seed_v24");
const { seedV25 } = require("./seed_v25");
const { seedV26 } = require("./seed_v26");
const { seedV27 } = require("./seed_v27");
const { seedV28 } = require("./seed_v28");
const { seedV29 } = require("./seed_v29");
const { seedV30 } = require("./seed_v30");
const { seedV31 } = require("./seed_v31");
const { seedV32 } = require("./seed_v32");
const { seedV33 } = require("./seed_v33");
const { seedV34 } = require("./seed_v34");
const { seedV35 } = require("./seed_v35");
const { seedV36 } = require("./seed_v36");
const { seedV37 } = require("./seed_v37");
const { seedV38 } = require("./seed_v38");
const { seedV39 } = require("./seed_v39");
const { seedV40 } = require("./seed_v40");
const { seedV41 } = require("./seed_v41");
const { seedV42 } = require("./seed_v42");
const { seedV43 } = require("./seed_v43");

const app = express();
const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'",
  });
  next();
});
app.use(compression());
app.use(express.json({ limit: "200kb" }));
app.use(session({
  store: new PgStore({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  name: "mt.sid",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: PROD, maxAge: 1000 * 60 * 60 * 24 * 14 },
}));
app.use(express.static(path.join(__dirname, "..", "public"), { index: false, maxAge: PROD ? "5m" : 0 }));

// ---------- helpers ----------
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const str = (v, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
async function audit(req, entity, entity_id, action, detail = {}) {
  await q("INSERT INTO audit (by_user,entity,entity_id,action,detail) VALUES ($1,$2,$3,$4,$5)",
    [req.user?.id || null, entity, String(entity_id), action, JSON.stringify(detail)]);
}
async function loadUser(req, res, next) {
  if (!req.session.uid) return bad(res, "Sign in to continue.", 401);
  const r = await q("SELECT id,email,name,role,must_change FROM users WHERE id=$1", [req.session.uid]);
  if (!r.rowCount) { req.session.destroy(() => {}); return bad(res, "Your account no longer exists.", 401); }
  req.user = r.rows[0];
  next();
}
const auth = wrap(loadUser);
const canWrite = (req, res, next) => (["admin", "editor"].includes(req.user.role) && !req.user.must_change ? next() : bad(res, req.user.must_change ? "Set a new password first." : "You have view-only access. Ask an admin for editor access.", 403));
const isAdmin = (req, res, next) => (req.user.role === "admin" ? next() : bad(res, "Only admins can do this.", 403));
// Mutations must come from our own page (blocks cross-site form posts).
app.use("/api", (req, res, next) => {
  if (req.method !== "GET" && req.get("x-requested-with") !== "mt") return bad(res, "Bad request origin.", 403);
  next();
});

// ---------- auth ----------
const attempts = new Map();
app.post("/api/login", wrap(async (req, res) => {
  const email = str(req.body.email, 200).toLowerCase();
  const key = req.ip + "|" + email;
  const a = attempts.get(key) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60 * 1000) { a.n = 0; a.t = Date.now(); }
  if (a.n >= 8) return bad(res, "Too many attempts. Try again in 15 minutes.", 429);
  const r = await q("SELECT id,pw_hash FROM users WHERE email=$1", [email]);
  const ok = r.rowCount && await bcrypt.compare(String(req.body.password || ""), r.rows[0].pw_hash);
  if (!ok) { a.n++; attempts.set(key, a); return bad(res, "Email or password is wrong.", 401); }
  attempts.delete(key);
  req.session.regenerate(err => {
    if (err) return bad(res, "Could not start a session.", 500);
    req.session.uid = r.rows[0].id;
    q("UPDATE users SET last_login=now() WHERE id=$1", [r.rows[0].id]).catch(() => {});
    res.json({ ok: true });
  });
}));
app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get("/api/me", auth, (req, res) => res.json(req.user));
app.post("/api/password", auth, wrap(async (req, res) => {
  const next = String(req.body.next || "");
  if (next.length < 10) return bad(res, "Use at least 10 characters.");
  const r = await q("SELECT pw_hash FROM users WHERE id=$1", [req.user.id]);
  if (!(await bcrypt.compare(String(req.body.current || ""), r.rows[0].pw_hash))) return bad(res, "Current password is wrong.");
  await q("UPDATE users SET pw_hash=$1, must_change=FALSE WHERE id=$2", [await bcrypt.hash(next, 12), req.user.id]);
  res.json({ ok: true });
}));

// ---------- state ----------
app.get("/api/state", auth, wrap(async (req, res) => {
  const [users, statuses, comments, logs, issues, results, kb, fields, impls, auditRows] = await Promise.all([
    q("SELECT id,name,role FROM users ORDER BY name"),
    q("SELECT key,state,by_user,at FROM statuses"),
    q("SELECT * FROM comments ORDER BY at"),
    q("SELECT * FROM logs ORDER BY at DESC"),
    q("SELECT * FROM issues ORDER BY at DESC"),
    q("SELECT * FROM results ORDER BY at"),
    q("SELECT * FROM kb ORDER BY title"),
    q("SELECT * FROM fields ORDER BY name"),
    q("SELECT * FROM impls ORDER BY system, name"),
    q("SELECT * FROM audit ORDER BY at DESC LIMIT 300"),
  ]);
  res.json({
    me: req.user, users: users.rows, statuses: statuses.rows, comments: comments.rows, logs: logs.rows,
    issues: issues.rows, results: results.rows, kb: kb.rows, fields: fields.rows, impls: impls.rows, audit: auditRows.rows,
  });
}));

// Cheap change check for the 30-second poll: the browser only reloads the full state when this changes.
app.get("/api/version", auth, wrap(async (req, res) => {
  const r = await q(`SELECT concat_ws('|',
    (SELECT count(*)||':'||coalesce(max(at)::text,'') FROM statuses), (SELECT count(*)||':'||coalesce(max(at)::text,'')||':'||coalesce(max(resolved_at)::text,'') FROM issues),
    (SELECT count(*)||':'||coalesce(max(at)::text,'') FROM impls), (SELECT count(*)||':'||coalesce(max(updated_at)::text,'') FROM fields),
    (SELECT count(*)||':'||coalesce(max(updated_at)::text,'') FROM kb), (SELECT count(*)||':'||coalesce(max(at)::text,'') FROM logs),
    (SELECT count(*)||':'||coalesce(max(at)::text,'') FROM comments), (SELECT count(*)||':'||coalesce(max(at)::text,'') FROM results),
    (SELECT coalesce(max(id),0) FROM audit), (SELECT count(*) FROM users)) AS v`);
  res.set("Cache-Control", "no-store").json({ v: r.rows[0].v, build: BUILD });
}));
app.post("/api/status", auth, canWrite, wrap(async (req, res) => {
  const key = str(req.body.key, 80), state = str(req.body.state, 20);
  if (!/^[a-z0-9-]+$/i.test(key) || !state) return bad(res, "Invalid status.");
  await q(`INSERT INTO statuses (key,state,by_user,at) VALUES ($1,$2,$3,now())
    ON CONFLICT (key) DO UPDATE SET state=EXCLUDED.state, by_user=EXCLUDED.by_user, at=now()`, [key, state, req.user.id]);
  res.json({ ok: true });
}));

// comments, logs, results: create + delete own (admins any)
function simpleCollection(table, cols, required) {
  app.post(`/api/${table}`, auth, canWrite, wrap(async (req, res) => {
    const vals = cols.map(c => (c === "value" ? Number(req.body[c]) : str(req.body[c], c === "text" ? 4000 : 400) || null));
    for (const r of required) if (vals[cols.indexOf(r)] == null || Number.isNaN(vals[cols.indexOf(r)])) return bad(res, `Missing ${r}.`);
    const ev = cols.indexOf("evidence");
    if (ev >= 0 && vals[ev] && !/^https?:\/\//i.test(vals[ev])) return bad(res, "Evidence must be a link starting with http.");
    const r = await q(`INSERT INTO ${table} (${cols.join(",")},by_user) VALUES (${cols.map((_, i) => "$" + (i + 1)).join(",")},$${cols.length + 1}) RETURNING id`, [...vals, req.user.id]);
    res.json({ id: r.rows[0].id });
  }));
  app.delete(`/api/${table}/:id`, auth, canWrite, wrap(async (req, res) => {
    const r = await q(`DELETE FROM ${table} WHERE id=$1 AND (by_user=$2 OR $3) RETURNING id`, [Number(req.params.id), req.user.id, req.user.role === "admin"]);
    if (!r.rowCount) return bad(res, "You can only delete your own entries.", 403);
    res.json({ ok: true });
  }));
}
simpleCollection("comments", ["sec", "text"], ["sec", "text"]);
simpleCollection("logs", ["sec", "ref", "date", "text", "evidence"], ["sec", "text"]);
simpleCollection("results", ["kpi", "value", "period", "note"], ["kpi", "value", "period"]);

// issues: log, then resolve with what worked
app.post("/api/issues", auth, canWrite, wrap(async (req, res) => {
  const title = str(req.body.title, 200), sec = str(req.body.sec, 60);
  if (!title || !sec) return bad(res, "Give the issue a title.");
  const sev = ["low", "medium", "high"].includes(req.body.severity) ? req.body.severity : "medium";
  const r = await q("INSERT INTO issues (sec,ref,title,detail,severity,by_user) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
    [sec, str(req.body.ref, 200), title, str(req.body.detail, 4000), sev, req.user.id]);
  res.json({ id: r.rows[0].id });
}));
app.patch("/api/issues/:id", auth, canWrite, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (req.body.state === "resolved") {
    const resolution = str(req.body.resolution, 4000);
    if (!resolution) return bad(res, "Describe what worked before resolving.");
    await q("UPDATE issues SET state='resolved', resolution=$1, resolved_by=$2, resolved_at=now() WHERE id=$3", [resolution, req.user.id, id]);
  } else if (req.body.state === "open") {
    await q("UPDATE issues SET state='open', resolved_at=NULL WHERE id=$1", [id]);
  } else return bad(res, "Unknown issue state.");
  res.json({ ok: true });
}));

// ---------- knowledge base ----------
const arr = (v, max = 40) => (Array.isArray(v) ? v.map(x => str(x, 1200)).filter(Boolean).slice(0, max) : []);
const sources = v => (Array.isArray(v) ? v.map(s => ({ title: str(s?.title, 200), url: str(s?.url, 500) })).filter(s => s.title && /^https?:\/\//.test(s.url)).slice(0, 20) : []);
app.put("/api/kb/:id", auth, canWrite, wrap(async (req, res) => {
  const id = str(req.params.id, 60).toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const b = req.body, title = str(b.title, 200);
  if (!id || !title) return bad(res, "Title is required.");
  const prev = await q("SELECT title FROM kb WHERE id=$1", [id]);
  await q(`INSERT INTO kb (id,title,system,pbs,summary,steps,practices,changes,sources,updated_by,updated_at,review_flag,review_note)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),FALSE,NULL)
    ON CONFLICT (id) DO UPDATE SET title=$2,system=$3,pbs=$4,summary=$5,steps=$6,practices=$7,changes=$8,sources=$9,updated_by=$10,updated_at=now()`,
    [id, title, str(b.system, 40) || "governance", JSON.stringify(arr(b.pbs, 20)), str(b.summary, 3000), JSON.stringify(arr(b.steps)), JSON.stringify(arr(b.practices)), JSON.stringify(arr(b.changes)), JSON.stringify(sources(b.sources)), req.user.id]);
  await audit(req, "kb", id, prev.rowCount ? "edited" : "created", { title });
  res.json({ id });
}));
app.post("/api/kb/:id/verify", auth, canWrite, wrap(async (req, res) => {
  await q("UPDATE kb SET verified_on=CURRENT_DATE, verified_by=$1, review_flag=FALSE, review_note=NULL WHERE id=$2", [req.user.name, req.params.id]);
  await audit(req, "kb", req.params.id, "verified");
  res.json({ ok: true });
}));
app.post("/api/kb/:id/flag", auth, canWrite, wrap(async (req, res) => {
  await q("UPDATE kb SET review_flag=TRUE, review_note=$1 WHERE id=$2", [str(req.body.note, 1000) || "Flagged for review", req.params.id]);
  await audit(req, "kb", req.params.id, "flagged", { note: str(req.body.note, 1000) });
  res.json({ ok: true });
}));

// ---------- tracking registry ----------
const FIELD_KINDS = ["event", "identifier", "parameter", "attribute"];
const PII = ["none", "pseudonymous", "personal", "sensitive"];
const slug = s => s.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
app.post("/api/fields", auth, canWrite, wrap(async (req, res) => {
  const name = str(req.body.name, 60), id = slug(name);
  if (!id) return bad(res, "Give the field a name.");
  if (!FIELD_KINDS.includes(req.body.kind)) return bad(res, "Choose a field type.");
  const exists = await q("SELECT id FROM fields WHERE id=$1 OR lower(name)=lower($2)", [id, name]);
  if (exists.rowCount) return bad(res, `A canonical field called ${name} already exists. Map to it instead of creating a duplicate.`);
  await q(`INSERT INTO fields (id,name,kind,description,measures,pii,owner,expected,status,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'proposed',$9)`,
    [id, name, req.body.kind, str(req.body.description, 1000), str(req.body.measures, 500), PII.includes(req.body.pii) ? req.body.pii : "none", str(req.body.owner, 80), JSON.stringify(arr(req.body.expected, 30)), req.user.id]);
  await audit(req, "field", id, "created", { name });
  res.json({ id });
}));
app.put("/api/fields/:id", auth, canWrite, wrap(async (req, res) => {
  const cur = await q("SELECT * FROM fields WHERE id=$1", [req.params.id]);
  if (!cur.rowCount) return bad(res, "Field not found.", 404);
  const f = cur.rows[0], b = req.body;
  const name = str(b.name, 60) || f.name;
  if (name.toLowerCase() !== f.name.toLowerCase()) {
    const clash = await q("SELECT id FROM fields WHERE lower(name)=lower($1) AND id<>$2", [name, f.id]);
    if (clash.rowCount) return bad(res, `${name} is already a canonical field. Merge instead of renaming.`);
  }
  let aliases = Array.isArray(b.aliases) ? arr(b.aliases, 30) : f.aliases;
  if (name !== f.name && !aliases.includes(f.name)) aliases = [...aliases, f.name];
  const status = ["approved", "proposed", "deprecated"].includes(b.status) ? b.status : f.status;
  await q(`UPDATE fields SET name=$1,kind=$2,description=$3,measures=$4,pii=$5,owner=$6,status=$7,aliases=$8,expected=$9,updated_by=$10,updated_at=now() WHERE id=$11`,
    [name, FIELD_KINDS.includes(b.kind) ? b.kind : f.kind, b.description != null ? str(b.description, 1000) : f.description, b.measures != null ? str(b.measures, 500) : f.measures,
      PII.includes(b.pii) ? b.pii : f.pii, b.owner != null ? str(b.owner, 80) : f.owner, status, JSON.stringify(aliases),
      JSON.stringify(Array.isArray(b.expected) ? arr(b.expected, 30) : f.expected), req.user.id, f.id]);
  await audit(req, "field", f.id, name !== f.name ? "renamed" : "edited", name !== f.name ? { from: f.name, to: name } : {});
  res.json({ ok: true });
}));
app.post("/api/fields/:id/merge", auth, canWrite, wrap(async (req, res) => {
  const from = req.params.id, into = str(req.body.into, 60);
  if (!into || into === from) return bad(res, "Choose the field to merge into.");
  const [a, b] = await Promise.all([q("SELECT * FROM fields WHERE id=$1", [from]), q("SELECT * FROM fields WHERE id=$1", [into])]);
  if (!a.rowCount || !b.rowCount) return bad(res, "Field not found.", 404);
  const src = a.rows[0], dst = b.rows[0];
  const aliases = [...new Set([...dst.aliases, src.name, ...src.aliases])].filter(x => x !== dst.name);
  const expected = [...new Set([...dst.expected, ...src.expected])];
  await q("UPDATE impls SET field_id=$1 WHERE field_id=$2", [into, from]);
  await q("UPDATE fields SET aliases=$1, expected=$2, updated_by=$3, updated_at=now() WHERE id=$4", [JSON.stringify(aliases), JSON.stringify(expected), req.user.id, into]);
  await q("UPDATE fields SET status='deprecated', merged_into=$1, updated_by=$2, updated_at=now() WHERE id=$3", [into, req.user.id, from]);
  await audit(req, "field", from, "merged", { into, from_name: src.name, into_name: dst.name });
  res.json({ ok: true });
}));

const IMPL_STATES = ["planned", "live", "rename-pending", "deprecated"];
function implVals(b, cur = {}) {
  return {
    field_id: b.field_id === "" ? null : (b.field_id != null ? str(b.field_id, 60) : cur.field_id ?? null),
    system: b.system != null ? str(b.system, 40) : cur.system,
    container: b.container != null ? str(b.container, 120) : cur.container || "",
    kind: b.kind != null ? str(b.kind, 60) : cur.kind,
    name: b.name != null ? str(b.name, 160) : cur.name,
    label: b.label != null ? str(b.label, 200) : cur.label || "",
    parent: b.parent != null ? str(b.parent, 200) : cur.parent || "",
    std: b.std != null ? !!b.std : !!cur.std,
    state: IMPL_STATES.includes(b.state) ? b.state : cur.state || "planned",
    description: b.description != null ? str(b.description, 1000) : cur.description || "",
  };
}
app.post("/api/impls", auth, canWrite, wrap(async (req, res) => {
  const v = implVals(req.body);
  if (!v.system || !v.kind || !v.name) return bad(res, "System, type and name are required.");
  const r = await q(`INSERT INTO impls (field_id,system,container,kind,name,label,parent,std,state,description,by_user)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [v.field_id, v.system, v.container, v.kind, v.name, v.label, v.parent, v.std, v.state, v.description, req.user.id]);
  await audit(req, "impl", r.rows[0].id, "created", { system: v.system, name: v.name, field: v.field_id });
  res.json({ id: r.rows[0].id });
}));
app.put("/api/impls/:id", auth, canWrite, wrap(async (req, res) => {
  const cur = await q("SELECT * FROM impls WHERE id=$1", [Number(req.params.id)]);
  if (!cur.rowCount) return bad(res, "Item not found.", 404);
  const c = cur.rows[0], v = implVals(req.body, c);
  await q(`UPDATE impls SET field_id=$1,system=$2,container=$3,kind=$4,name=$5,label=$6,parent=$7,std=$8,state=$9,description=$10,by_user=$11,at=now() WHERE id=$12`,
    [v.field_id, v.system, v.container, v.kind, v.name, v.label, v.parent, v.std, v.state, v.description, req.user.id, c.id]);
  const changed = ["field_id", "name", "state", "system"].filter(k => String(c[k] ?? "") !== String(v[k] ?? ""));
  await audit(req, "impl", c.id, "edited", Object.fromEntries(changed.map(k => [k, { from: c[k], to: v[k] }])));
  res.json({ ok: true });
}));
app.post("/api/impls/:id/align", auth, canWrite, wrap(async (req, res) => {
  const r = await q("SELECT i.*, f.name AS fname FROM impls i LEFT JOIN fields f ON f.id=i.field_id WHERE i.id=$1", [Number(req.params.id)]);
  if (!r.rowCount || !r.rows[0].fname) return bad(res, "Map this item to a canonical field first.");
  const i = r.rows[0];
  await q("UPDATE impls SET state='rename-pending', rename_to=$1, by_user=$2, at=now() WHERE id=$3", [i.fname, req.user.id, i.id]);
  await audit(req, "impl", i.id, "rename requested", { system: i.system, from: i.name, to: i.fname });
  res.json({ ok: true });
}));
app.post("/api/impls/:id/renamed", auth, canWrite, wrap(async (req, res) => {
  const r = await q("SELECT * FROM impls WHERE id=$1", [Number(req.params.id)]);
  if (!r.rowCount || !r.rows[0].rename_to) return bad(res, "No rename is pending for this item.");
  const i = r.rows[0];
  await q("UPDATE impls SET name=rename_to, rename_to=NULL, state='live', by_user=$1, at=now() WHERE id=$2", [req.user.id, i.id]);
  await audit(req, "impl", i.id, "renamed", { system: i.system, from: i.name, to: i.rename_to });
  res.json({ ok: true });
}));
app.post("/api/impls/:id/std", auth, canWrite, wrap(async (req, res) => {
  const r = await q("UPDATE impls SET std=$1, rename_to=NULL, state=CASE WHEN state='rename-pending' THEN 'live' ELSE state END WHERE id=$2 RETURNING system,name", [!!req.body.std, Number(req.params.id)]);
  if (!r.rowCount) return bad(res, "Item not found.", 404);
  await audit(req, "impl", req.params.id, req.body.std ? "marked platform-required name" : "unmarked platform-required name", r.rows[0]);
  res.json({ ok: true });
}));
// Bulk import of what is already set up in a system. Re-importing the same system/container updates items instead of duplicating them.
app.post("/api/impls/bulk", auth, canWrite, wrap(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 1500) : [];
  if (!items.length) return bad(res, "Nothing to import.");
  const fieldIds = new Set((await q("SELECT id FROM fields")).rows.map(r => r.id));
  const client = await pool.connect();
  let created = 0, updated = 0, replacedPlaceholder = 0;
  try {
    await client.query("BEGIN");
    for (const raw of items) {
      const v = implVals(raw);
      if (!v.system || !v.kind || !v.name) continue;
      if (v.field_id && !fieldIds.has(v.field_id)) v.field_id = null;
      // GTM tags, triggers and variables often share a name (a tag's event name = its trigger's event), so there the kind must match too.
      const ex = await client.query(`SELECT id FROM impls WHERE system=$1 AND container=$2 AND (lower(name)=lower($3) OR ($4<>'' AND lower(label)=lower($4)))
        AND ($1<>'gtm' OR kind=$5) ORDER BY (lower(name)=lower($3)) DESC, (kind=$5) DESC LIMIT 1`, [v.system, v.container, v.name, v.label, v.kind]);
      if (ex.rowCount) {
        await client.query(`UPDATE impls SET field_id=COALESCE($1,field_id), kind=$2, label=$3, parent=CASE WHEN $4='' THEN parent ELSE $4 END, std=$5, state=$6,
          description=CASE WHEN $7='' THEN description ELSE $7 END, by_user=$8, at=now(), name=$10 WHERE id=$9`,
          [v.field_id, v.kind, v.label, v.parent, v.std, v.state, v.description, req.user.id, ex.rows[0].id, v.name]);
        updated++; continue;
      }
      if (v.field_id) {
        const ph = await client.query("SELECT id FROM impls WHERE system=$1 AND field_id=$2 AND (name LIKE '[%' OR (by_user IS NULL AND container='')) LIMIT 1", [v.system, v.field_id]);
        if (ph.rowCount) {
          await client.query(`UPDATE impls SET container=$1, kind=$2, name=$3, label=$4, parent=$5, std=$6, state=$7, description=$8, by_user=$9, at=now() WHERE id=$10`,
            [v.container, v.kind, v.name, v.label, v.parent, v.std, v.state, v.description || "Imported; replaced a placeholder.", req.user.id, ph.rows[0].id]);
          replacedPlaceholder++; continue;
        }
      }
      await client.query(`INSERT INTO impls (field_id,system,container,kind,name,label,parent,std,state,description,by_user) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [v.field_id, v.system, v.container, v.kind, v.name, v.label, v.parent, v.std, v.state, v.description, req.user.id]);
      created++;
    }
    await client.query(`INSERT INTO audit (by_user,entity,entity_id,action,detail) VALUES ($1,'import',$2,'imported',$3)`,
      [req.user.id, String(items[0].system || ""), JSON.stringify({ system: items[0].system, container: items[0].container || "", created, updated, replacedPlaceholder })]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  res.json({ created, updated, replacedPlaceholder });
}));
app.post("/api/impls/deprecate", auth, canWrite, wrap(async (req, res) => {
  const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Boolean).slice(0, 1500);
  if (!ids.length) return bad(res, "Nothing selected.");
  await q("UPDATE impls SET state='deprecated', by_user=$1, at=now() WHERE id = ANY($2)", [req.user.id, ids]);
  await audit(req, "impl", ids.join(","), "marked deprecated", { count: ids.length });
  res.json({ ok: true });
}));
app.delete("/api/impls/:id", auth, canWrite, wrap(async (req, res) => {
  const r = await q("DELETE FROM impls WHERE id=$1 RETURNING system,name", [Number(req.params.id)]);
  if (r.rowCount) await audit(req, "impl", req.params.id, "deleted", r.rows[0]);
  res.json({ ok: true });
}));

// ---------- admin: users ----------
const tempPassword = () => crypto.randomBytes(9).toString("base64url");
app.get("/api/users", auth, isAdmin, wrap(async (req, res) => {
  res.json((await q("SELECT id,email,name,role,must_change,created_at,last_login FROM users ORDER BY name")).rows);
}));
app.post("/api/users", auth, isAdmin, wrap(async (req, res) => {
  const email = str(req.body.email, 200).toLowerCase(), name = str(req.body.name, 100);
  const role = ["admin", "editor", "viewer"].includes(req.body.role) ? req.body.role : "editor";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) return bad(res, "Enter a name and a valid email.");
  const pw = tempPassword();
  try {
    await q("INSERT INTO users (email,name,role,pw_hash,must_change) VALUES ($1,$2,$3,$4,TRUE)", [email, name, role, await bcrypt.hash(pw, 12)]);
  } catch (e) {
    if (e.code === "23505") return bad(res, "That email already has an account.");
    throw e;
  }
  await audit(req, "user", email, "invited", { role });
  res.json({ email, tempPassword: pw });
}));
app.patch("/api/users/:id", auth, isAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (req.body.role) {
    if (!["admin", "editor", "viewer"].includes(req.body.role)) return bad(res, "Unknown role.");
    if (id === req.user.id && req.body.role !== "admin") return bad(res, "You cannot remove your own admin role.");
    await q("UPDATE users SET role=$1 WHERE id=$2", [req.body.role, id]);
    await audit(req, "user", id, "role changed", { role: req.body.role });
    return res.json({ ok: true });
  }
  if (req.body.reset) {
    const pw = tempPassword();
    await q("UPDATE users SET pw_hash=$1, must_change=TRUE WHERE id=$2", [await bcrypt.hash(pw, 12), id]);
    await q("DELETE FROM session WHERE (sess->>'uid')::int = $1", [id]).catch(() => {});
    await audit(req, "user", id, "password reset");
    return res.json({ tempPassword: pw });
  }
  bad(res, "Nothing to change.");
}));
app.delete("/api/users/:id", auth, isAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return bad(res, "You cannot remove yourself.");
  await q("DELETE FROM users WHERE id=$1", [id]);
  await q("DELETE FROM session WHERE (sess->>'uid')::int = $1", [id]).catch(() => {});
  await audit(req, "user", id, "removed");
  res.json({ ok: true });
}));

// ---------- CSV exports ----------
const csv = rows => {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = v => {
    let s = v == null ? "" : v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map(r => cols.map(c => cell(r[c])).join(","))].join("\n");
};
const EXPORTS = {
  registry: `SELECT f.name AS canonical_field, f.kind AS field_type, f.status AS field_status, f.pii, f.owner, f.description, f.measures,
      i.system, i.container, i.kind AS item_type, i.name AS name_in_system, i.label AS display_name, i.parent, i.std AS platform_required_name,
      i.state, i.rename_to, i.description AS item_notes, u.name AS last_changed_by, i.at AS last_changed_at
    FROM impls i LEFT JOIN fields f ON f.id=i.field_id LEFT JOIN users u ON u.id=i.by_user ORDER BY f.name NULLS FIRST, i.system`,
  fields: `SELECT name, kind, status, pii, owner, description, measures, aliases, expected, merged_into, updated_at FROM fields ORDER BY name`,
  logs: `SELECT l.at, l.sec AS section, l.ref, l.date AS implemented_on, l.text AS what_was_implemented, l.evidence, u.name AS by FROM logs l LEFT JOIN users u ON u.id=l.by_user ORDER BY l.at DESC`,
  issues: `SELECT i.at, i.sec AS section, i.ref, i.title, i.detail, i.severity, i.state, i.resolution AS what_worked, u.name AS logged_by, r.name AS resolved_by, i.resolved_at
    FROM issues i LEFT JOIN users u ON u.id=i.by_user LEFT JOIN users r ON r.id=i.resolved_by ORDER BY i.at DESC`,
};
app.get("/api/export/:what.csv", auth, wrap(async (req, res) => {
  const sql = EXPORTS[req.params.what];
  if (!sql) return bad(res, "Unknown export.", 404);
  const rows = (await q(sql)).rows;
  res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="wetility-${req.params.what}-${new Date().toISOString().slice(0, 10)}.csv"` });
  res.send("﻿" + csv(rows));
}));

// Executive summary: JSON for the Home card, Word and Excel downloads.
const summary = require("./summary");
app.get("/api/summary", auth, wrap(async (req, res) => res.json(await summary.build())));
app.get("/api/summary.:fmt(docx|xlsx)", auth, wrap(async (req, res) => {
  const s = await summary.build(), fmt = req.params.fmt;
  const buf = fmt === "docx" ? await summary.toDocx(s) : await summary.toXlsx(s);
  const type = fmt === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  res.set({ "Content-Type": type, "Content-Disposition": `attachment; filename="wetility-martech-executive-summary-${new Date().toISOString().slice(0, 10)}.${fmt}"`, "Cache-Control": "no-store" });
  res.send(Buffer.from(buf));
}));

require("./connectors").routes(app, { auth, isAdmin, wrap, bad });
// Conversion value model: products x funnel stages, owned in one place (configuration, no customer data).
const VM_DEFAULT = {
  currency: "ZAR",
  stages: [
    { key: "lead_submitted", label: "Lead submitted", p: null, ads: "yes" },
    { key: "contacted", label: "Contacted (first call or consult)", p: null, ads: "yes" },
    { key: "docs_submitted", label: "Credit documents submitted", p: null, ads: "yes" },
    { key: "credit_approved", label: "Credit approved", p: null, ads: "approval" },
    { key: "contract_signed", label: "Contract signed", p: null, ads: "confirm" },
    { key: "installed", label: "Installed (CoC issued)", p: 1, ads: "yes" }
  ],
  products: ["Pace Mini", "Pace Medi", "Pace Medi Plus", "Pace Maxi", "Pace Maxi 3PH", "Pace Mega", "Pace Xtra", "Pace Backup", "Pace Core", "Lift Series", "Rise Series", "Luxe Series", "Flare"].map(name => ({ name, value: null })),
  basis: "", updatedAt: null, updatedBy: null
};
app.get("/api/value-model", auth, wrap(async (req, res) => {
  const r = await q("SELECT value FROM settings WHERE key='value_model'");
  res.json(r.rowCount ? JSON.parse(r.rows[0].value) : VM_DEFAULT);
}));
app.put("/api/value-model", auth, canWrite, wrap(async (req, res) => {
  const b = req.body || {}, num = (v, max) => { if (v === "" || v == null) return null; const n = Number(String(v).replace(/[\s,R]/g, "")); return Number.isFinite(n) && n >= 0 && n <= max ? n : null; };
  const vm = {
    currency: "ZAR",
    stages: (Array.isArray(b.stages) ? b.stages : VM_DEFAULT.stages).slice(0, 12).map((x, i) => ({ key: String(x.key || VM_DEFAULT.stages[i]?.key || "stage_" + i).slice(0, 60), label: String(x.label || "").slice(0, 80), p: num(x.p, 1), ads: ["yes", "approval", "confirm", "no"].includes(x.ads) ? x.ads : "yes" })),
    products: (Array.isArray(b.products) ? b.products : []).slice(0, 60).map(x => ({ name: String(x.name || "").trim().slice(0, 60), value: num(x.value, 1e9) })).filter(x => x.name),
    basis: String(b.basis || "").slice(0, 1000), updatedAt: new Date().toISOString(), updatedBy: req.user.name
  };
  await q(`INSERT INTO settings (key,value,updated_by,updated_at) VALUES ('value_model',$1,$2,now()) ON CONFLICT (key) DO UPDATE SET value=$1, updated_by=$2, updated_at=now()`, [JSON.stringify(vm), req.user.id]);
  await q("INSERT INTO audit (by_user,entity,entity_id,action) VALUES ($1,'settings','value_model','value model updated')", [req.user.id]);
  res.json(vm);
}));

app.get("/healthz", (req, res) => res.json({ ok: true }));
// index.html is served with a build stamp on every script and stylesheet, so a phone never mixes old and new files after a deploy.
const BUILD = (process.env.RAILWAY_GIT_COMMIT_SHA || String(Date.now())).slice(0, 12);
const INDEX = require("fs").readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8").replace(/(src|href)="(\/[^"]+\.(?:js|css))"/g, `$1="$2?v=${BUILD}"`);
app.get("*", (req, res) => { res.set("Cache-Control", "no-cache"); res.type("html").send(INDEX); });
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server. Try again; if it repeats, log an issue." });
});

(async () => {
  await init();
  await seed();
  await seedV2();
  await seedV3();
  await seedV4();
  await seedV5();
  await seedV6();
  await seedV7();
  await seedV8();
  await seedV9();
  await seedV10();
  await seedV11();
  await seedV12();
  await seedV13();
  await seedV14();
  await seedV15();
  await seedV16();
  await seedV17();
  await seedV18();
  await seedV19();
  await seedV20();
  await seedV21();
  await seedV22();
  await seedV23();
  await seedV24();
  await seedV25();
  await seedV26();
  await seedV27();
  await seedV28();
  await seedV29();
  await seedV30();
  await seedV31();
  await seedV32();
  await seedV33();
  await seedV34();
  await seedV35();
  await seedV36();
  await seedV37();
  await seedV38();
  await seedV39();
  await seedV40();
  await seedV41();
  await seedV42();
  await seedV43();
  q(`SELECT (SELECT count(*) FROM impls) n_impls, (SELECT count(*) FROM issues) n_issues,
      (SELECT sum(length(row_to_json(t)::text)) FROM impls t) + (SELECT sum(length(row_to_json(t)::text)) FROM issues t) + (SELECT coalesce(sum(length(row_to_json(t)::text)),0) FROM kb t) + (SELECT coalesce(sum(length(row_to_json(t)::text)),0) FROM fields t) AS state_bytes`)
    .then(r => console.log("STATE SIZE", JSON.stringify(r.rows[0]))).catch(() => {});
  await ensureAdmin();
  app.listen(PORT, () => console.log(`MarTech guide listening on ${PORT}`));
})().catch(e => { console.error(e); process.exit(1); });
