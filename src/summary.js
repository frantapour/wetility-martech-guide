// Executive summary: curated findings plus live status from the database. Feeds the Home card and the Word and Excel downloads.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { q } = require("./db");

const AS_OF = "1 November 2026";

function plan() {
  const src = fs.readFileSync(path.join(__dirname, "..", "public", "plan.js"), "utf8");
  return vm.runInNewContext(src + ";({ SPECIALIST, GAPS, ACCESS, ACTIONS })");
}

const HEADLINE = "Leads are being tracked, but Wetility does not own or control several of the accounts that track and buy them, and private customer data sits in tools that do not need it. The plan: fix ownership and privacy now, build one clean set of lead signals alongside the current ones, and switch platform by platform after 19 January so leads do not drop.";

const MESSAGES = [
  ["Ownership", "Google Ads sits under iLead and Wetility has no access. Two Meta ad accounts, including the one in use, are owned by Growth Charter. DarkMatter owns the TikTok pixel and the Meta app dataset. Wetility owns its TikTok Business Center and ad account, the Meta Page, Instagram and WhatsApp numbers."],
  ["Privacy", "Bank, ID and credit data are open fields in Freshsales and respond.io. Meta measures conversions on customers' devices from 12 November unless the Information Officer decides otherwise. Third-party AI agents can currently take every action on three Meta ad accounts."],
  ["Measurement", "There is no single definition of a lead: about 20 GA4 lead events and 30 key events, three Meta lead events and three Amplitude projects. Sales outcomes (credit approved, contract signed, installed) are not sent back to the ad platforms, so they optimise for form fills, not customers."],
  ["Website and search", "18,964 website sessions in 30 days; Google sends 5,845 and TikTok 4,719. 8.6% of sessions hit unresponsive clicks, mostly in the bundle configurator. Organic search brings about 4,400 visits a month, but about 86% are people already searching for Wetility."],
  ["Plan and timing", "Thato (digital marketing specialist) starts on 7 November and owns the build. Freeze from 20 November to 5 December except risk fixes; no bidding or primary-conversion changes before 19 January. New signals run in parallel and report only, then switch one platform at a time with rollback triggers."]
];

// [metric, value, source, as of]
const METRICS = [
  ["Website sessions (30 days, www)", 18964, "Microsoft Clarity", "1 Nov 2026"],
  ["Unique website users (30 days)", 15872, "Microsoft Clarity", "1 Nov 2026"],
  ["Sessions from Google", 5845, "Clarity referrers", "1 Nov 2026"],
  ["Sessions from TikTok", 4719, "Clarity referrers", "1 Nov 2026"],
  ["Sessions from Instagram and Facebook", 1022, "Clarity referrers", "1 Nov 2026"],
  ["Sessions with a form submitted", 1238, "Clarity smart events", "1 Nov 2026"],
  ["Sessions with 'Order success'", 460, "Clarity smart events", "1 Nov 2026"],
  ["Sessions with dead clicks", "8.6%", "Microsoft Clarity", "1 Nov 2026"],
  ["Sessions with JavaScript errors", "2.5%", "Microsoft Clarity", "1 Nov 2026"],
  ["Website performance score", "71 / 100", "Microsoft Clarity", "1 Nov 2026"],
  ["Organic search visits per month", 4400, "Semrush (ZA, desktop)", "31 Oct 2026"],
  ["Of which branded (searching 'Wetility')", 3800, "Semrush", "31 Oct 2026"],
  ["Organic keywords ranking", 94, "Semrush", "31 Oct 2026"],
  ["Semrush site health", "71%", "Semrush site audit (June 2026)", "31 Oct 2026"],
  ["GA4 key events", "about 30", "GA4 sync", "1 Nov 2026"],
  ["GA4 lead events", "about 20", "GA4 sync", "1 Nov 2026"],
  ["Meta lead events", 3, "Meta Events Manager", "1 Nov 2026"],
  ["Amplitude projects", 3, "Amplitude sync", "1 Nov 2026"]
];

// [platform, asset, owner, Wetility access, risk]
const OWNERSHIP = [
  ["Google Ads", "Ad account AW-11401670719", "iLead (agency)", "None", "High"],
  ["Google Tag Manager", "wetility.energy GTM-N9XFQZMK", "Wetility", "Yes", "Low"],
  ["Google Tag Manager", "Versofy web and server containers", "Wetility (Versofy brand)", "Yes", "Medium: server hosting and payer unknown"],
  ["GA4", "Wetility property", "Wetility", "Yes", "Low"],
  ["Meta", "Ad accounts 1006220581257195 and 1256269948970846 (in use)", "Growth Charter (former agency)", "Full, as a user", "High"],
  ["Meta", "Wetility Ad Account 554889355978936", "Wetility", "Yes; Cortado also has full access", "Medium"],
  ["Meta", "Website dataset 331051689290488 and Conversions API Gateway", "Second Wetility portfolio 1635612940192332", "Unknown", "High"],
  ["Meta", "App dataset 3042604735938584 and Wetillity app", "DarkMatter", "Shared", "High"],
  ["Meta", "Page, Instagram, WhatsApp numbers", "Wetility", "Yes", "Low"],
  ["Meta", "Business portfolio 268835702018155", "Wetility", "Yes; verification never submitted", "Medium"],
  ["TikTok", "Business Center 7696451525908004916 (verified)", "Wetility", "Yes", "Low"],
  ["TikTok", "Ad account 7455352392268169232", "Wetility (DarkMatter runs it)", "Yes", "Low"],
  ["TikTok", "Pixel D0ESSGJC77U75NH4NU60", "DarkMatter (cannot move again)", "Shared", "High"],
  ["Microsoft Clarity", "Wetility Website project", "Admins: Palota, Ikenna, Lynn", "Member only", "Medium"],
  ["Amplitude", "Three projects", "Wetility and DarkMatter", "Yes", "Medium"],
  ["Freshsales", "CRM", "Wetility", "Yes", "High: bank, ID and credit fields open"],
  ["respond.io", "WhatsApp", "Wetility", "Yes", "High: bank, ID and credit data in chats"]
];

const STATE_LABEL = { todo: "Not started", progress: "In progress", done: "Done", blocked: "Blocked" };

async function build() {
  const { GAPS, ACTIONS } = plan();
  const statuses = Object.fromEntries((await q("SELECT key, state FROM statuses")).rows.map(r => [r.key, r.state]));
  const st = k => statuses[k] || "todo";
  const issues = (await q("SELECT id, title, detail, severity, state, at FROM issues ORDER BY CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, at DESC")).rows;
  const open = issues.filter(i => i.state === "open");
  const today = new Date().toISOString().slice(0, 10);
  const actions = [...ACTIONS].sort((a, b) => a[1].localeCompare(b[1])).map(([id, due, title, owner, how, gaps]) => {
    const s = st("act-" + id);
    return { id, due, title, owner, how, gaps, status: STATE_LABEL[s] || s, overdue: s !== "done" && due < today };
  });
  const gaps = GAPS.map(g => ({ id: g[0], title: g[1], owner: g[3], effort: g[4], when: g[6], kind: g[7], status: STATE_LABEL[st("gap-" + g[0])] || st("gap-" + g[0]) }));
  // Latest Clarity pull (Settings → Microsoft Clarity → Sync), if any: adds live website rows to the key data.
  const metrics = [...METRICS];
  try {
    const r = await q("SELECT value FROM settings WHERE key='clarity:latest'");
    if (r.rowCount) {
      const cl = JSON.parse(r.rows[0].value), T = cl.totals || {}, asof = new Date(cl.at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }), src = `Clarity API, last ${cl.days} days`;
      const find = re => Object.entries(T).find(([k]) => re.test(k))?.[1] || {};
      const pick = (o, ...keys) => { for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k]; return null; };
      const pct = v => v === null ? null : `${Number(v).toFixed(1)}%`;
      const tr = find(/traffic/i);
      [["Sessions", pick(tr, "totalSessionCount")], ["Users", pick(tr, "distinctUserCount", "distantUserCount")],
       ["Sessions with dead clicks", pct(pick(find(/dead/i), "sessionsWithMetricPercentage"))], ["Sessions with rage clicks", pct(pick(find(/rage/i), "sessionsWithMetricPercentage"))],
       ["Sessions with JavaScript errors", pct(pick(find(/scripterror/i), "sessionsWithMetricPercentage"))], ["Average scroll depth", pct(pick(find(/scroll ?depth/i), "averageScrollDepth"))]]
        .forEach(([k, v]) => { if (v !== null) metrics.push([`${k} (live)`, isNaN(v) ? v : Number(v), src, asof]); });
      (cl.bySource || []).slice(0, 5).forEach(x => metrics.push([`Sessions from ${x.source} (live)`, x.sessions, src, asof]));
    }
  } catch (e) { /* summary still renders without live data */ }
  const counts = {
    issuesOpen: open.length,
    issuesHigh: open.filter(i => i.severity === "high").length,
    actionsDone: actions.filter(a => a.status === "Done").length,
    actionsTotal: actions.length,
    actionsOverdue: actions.filter(a => a.overdue).length,
    gapsDone: gaps.filter(g => g.status === "Done").length,
    gapsTotal: gaps.length
  };
  return { asOf: AS_OF, generated: new Date().toISOString(), headline: HEADLINE, messages: MESSAGES, metrics, ownership: OWNERSHIP, counts, actions, gaps,
    highIssues: open.filter(i => i.severity === "high").map(i => ({ title: i.title, detail: i.detail })),
    openIssues: open.map(i => ({ id: i.id, severity: i.severity, title: i.title, detail: i.detail, logged: i.at })) };
}

const fmtDue = d => new Date(d + "T12:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
const fmtNum = v => typeof v === "number" ? v.toLocaleString("en-ZA") : v;

async function toDocx(s) {
  const D = require("docx");
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, ShadingType, AlignmentType } = D;
  const NAVY = "0B1F3A", SUN = "F5A623";
  const p = (text, o = {}) => new Paragraph({ spacing: { after: 120 }, ...o, children: [new TextRun({ text, size: 21, ...(o.run || {}) })] });
  const h = (text, level = HeadingLevel.HEADING_1) => new Paragraph({ heading: level, spacing: { before: 280, after: 120 }, children: [new TextRun({ text, color: NAVY, bold: true, size: level === HeadingLevel.HEADING_1 ? 28 : 24 })] });
  const cell = (text, head, w) => new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, shading: head ? { type: ShadingType.CLEAR, fill: NAVY, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 }, children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ""), bold: !!head, color: head ? "FFFFFF" : undefined, size: 18 })] })] });
  const table = (head, rows, widths) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ tableHeader: true, children: head.map((t, i) => cell(t, true, widths[i])) }), ...rows.map(r => new TableRow({ children: r.map((t, i) => cell(t, false, widths[i])) }))] });
  const c = s.counts;
  const openActions = s.actions.filter(a => a.status !== "Done");
  const doc = new Document({
    creator: "Wetility MarTech guide", title: "MarTech executive summary",
    styles: { default: { document: { run: { font: "Calibri" } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children: [
      new Paragraph({ children: [new TextRun({ text: "WETILITY · MARTECH PROGRAMME", color: SUN, bold: true, size: 18 })] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Executive summary", bold: true, size: 40, color: NAVY })] }),
      p(`Findings as of ${s.asOf}. Status generated ${new Date(s.generated).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} (SAST).`, { run: { color: "666666", size: 18 } }),
      h("The answer"),
      p(s.headline, { run: { bold: true } }),
      p(`Status: ${c.actionsDone} of ${c.actionsTotal} actions done${c.actionsOverdue ? `, ${c.actionsOverdue} overdue` : ""}; ${c.gapsDone} of ${c.gapsTotal} gaps closed; ${c.issuesOpen} open problems, ${c.issuesHigh} of them high.`),
      h("Key messages"),
      ...s.messages.map(([k, v]) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 100 }, children: [new TextRun({ text: k + ": ", bold: true, size: 21 }), new TextRun({ text: v, size: 21 })] })),
      h("Key data points"),
      table(["Metric", "Value", "Source", "As of"], s.metrics.map(m => [m[0], fmtNum(m[1]), m[2], m[3]]), [46, 14, 24, 16]),
      h("Who owns what"),
      table(["Platform", "Asset", "Owner", "Wetility access", "Risk"], s.ownership, [14, 30, 20, 18, 18]),
      h("Next actions"),
      openActions.length ? table(["ID", "Due", "Action", "Owner", "Status"], openActions.map(a => [a.id, fmtDue(a.due) + (a.overdue ? " (overdue)" : ""), a.title, a.owner, a.status]), [7, 15, 42, 24, 12]) : p("All actions are done."),
      h("High-priority problems"),
      ...(s.highIssues.length ? s.highIssues.map(i => new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: i.title, size: 20 })] })) : [p("None open.")]),
      h("Gaps to close"),
      table(["ID", "Gap", "Owner", "When", "Status"], s.gaps.map(g => [g.id, g.title, g.owner, g.when, g.status]), [7, 43, 22, 16, 12]),
      new Paragraph({ spacing: { before: 240 }, alignment: AlignmentType.LEFT, children: [new TextRun({ text: "Full detail, sources and live status: the Wetility MarTech guide (martech-guide-production.up.railway.app).", size: 16, color: "666666" })] })
    ] }]
  });
  return Packer.toBuffer(doc);
}

async function toXlsx(s) {
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Wetility MarTech guide"; wb.created = new Date();
  const NAVY = "FF0B1F3A";
  const sheet = (name, cols, rows) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = cols.map(([header, key, width]) => ({ header, key, width }));
    rows.forEach(r => ws.addRow(r));
    const hr = ws.getRow(1); hr.font = { bold: true, color: { argb: "FFFFFFFF" } }; hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    ws.eachRow((row, n) => { if (n > 1) row.alignment = { vertical: "top", wrapText: true }; });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    return ws;
  };
  const c = s.counts;
  const sum = wb.addWorksheet("Summary");
  sum.columns = [{ width: 26 }, { width: 110 }];
  sum.addRow(["Wetility MarTech executive summary"]).font = { bold: true, size: 16, color: { argb: NAVY } };
  sum.addRow(["Findings as of", s.asOf]);
  sum.addRow(["Status generated", new Date(s.generated).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }) + " SAST"]);
  sum.addRow([]);
  sum.addRow(["The answer", s.headline]);
  s.messages.forEach(([k, v]) => sum.addRow([k, v]));
  sum.addRow([]);
  [["Actions done", `${c.actionsDone} of ${c.actionsTotal}`], ["Actions overdue", c.actionsOverdue], ["Gaps closed", `${c.gapsDone} of ${c.gapsTotal}`], ["Open problems", c.issuesOpen], ["Open high-priority problems", c.issuesHigh]].forEach(r => sum.addRow(r));
  sum.eachRow(row => { row.alignment = { vertical: "top", wrapText: true }; row.getCell(1).font = { bold: true }; });
  sheet("Key data", [["Metric", "metric", 42], ["Value", "value", 14], ["Source", "source", 30], ["As of", "asof", 14]], s.metrics.map(m => ({ metric: m[0], value: m[1], source: m[2], asof: m[3] })))
    .getColumn("value").numFmt = "#,##0";
  sheet("Ownership", [["Platform", "p", 18], ["Asset", "a", 50], ["Owner", "o", 34], ["Wetility access", "w", 30], ["Risk", "r", 36]], s.ownership.map(o => ({ p: o[0], a: o[1], o: o[2], w: o[3], r: o[4] })));
  sheet("Actions", [["ID", "id", 6], ["Due", "due", 12], ["Action", "title", 56], ["Owner", "owner", 34], ["Status", "status", 13], ["Overdue", "overdue", 9], ["Closes gaps", "gaps", 12], ["How", "how", 90]],
    s.actions.map(a => ({ ...a, due: new Date(a.due + "T12:00:00"), overdue: a.overdue ? "Yes" : "" }))).getColumn("due").numFmt = "d mmm yyyy";
  sheet("Gaps", [["ID", "id", 6], ["Gap", "title", 60], ["Owner", "owner", 34], ["Effort", "effort", 22], ["When", "when", 30], ["Type", "kind", 11], ["Status", "status", 13]], s.gaps);
  sheet("Open problems", [["ID", "id", 7], ["Severity", "severity", 10], ["Problem", "title", 70], ["Logged", "logged", 13], ["Detail", "detail", 110]],
    s.openIssues.map(i => ({ ...i, logged: new Date(i.logged) }))).getColumn("logged").numFmt = "d mmm yyyy";
  return wb.xlsx.writeBuffer();
}

module.exports = { build, toDocx, toXlsx };
