// v18: respond.io conversation fields from the conversations export header (field names only), 1 Nov 2026.
const { q, pool } = require("./db");
const Importer = require("../public/importer.js");
const F = ["Conversation ID", "DateTime Conversation Started", "DateTime Conversation Resolved", "Contact ID", "Assignee", "Number of Outgoing Messages", "Number of Incoming Messages", "DateTime First Response", "Conversation Category", "Closing Note Summary", "Closed By", "First Response Time", "Resolution Time", "First Assignee", "Closed By Source", "Closed By Team", "Opened By Source", "Opened By Channel", "First Assignment Timestamp", "First Response By", "Last Assignment Timestamp", "Last Assignee", "Time to First Assignment", "First Assignment to First Response Time", "Last Assignment to Response Time", "First Assignment to Close Time", "Last Assignment to Close Time", "Average Response Time", "Number of Assignments", "Number of Responses", "Sentiment", "Sentiment Reason"];
const GROUP = l => /time|timestamp|datetime/i.test(l) && !/^DateTime Conversation/.test(l) ? "Speed and service levels" : /source|channel/i.test(l) ? "Origin" : /sentiment|summary|category/i.test(l) ? "Quality" : "Conversation";
const ISSUES = [
  ["pb48", "General", "medium", "Use respond.io response times for speed-to-lead and the 'contacted' step",
    "The conversations export has DateTime Conversation Started, DateTime First Response, First Response Time and Time to First Assignment. These give a speed-to-lead KPI for WhatsApp leads (target: first human or agent response within 5 minutes in working hours) and the timestamp for the 'contacted' step of the journey. Opened By Source and Opened By Channel show how a chat started, but not which ad: that needs the click-to-WhatsApp referral (ctwa_clid, ad ID) captured on the contact. Closing Note Summary and Sentiment Reason are free text and can contain personal details, so keep them out of analytics exports."]
];
async function seedV18() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v18'")).rowCount) return;
  const fields = (await q("SELECT id,name,aliases,status FROM fields")).rows;
  const client = await pool.connect(); let added = 0;
  try {
    await client.query("BEGIN");
    for (const label of F) {
      const name = Importer.slug(label);
      if ((await client.query("SELECT 1 FROM impls WHERE system='respond' AND container='Conversation fields' AND lower(name)=lower($1)", [name])).rowCount) continue;
      const sug = Importer.suggest({ name, label }, fields);
      await client.query("INSERT INTO impls (field_id,system,container,kind,name,label,parent,std,state,description) VALUES ($1,'respond','Conversation fields','field',$2,$3,$4,TRUE,'live',$5)",
        [sug ? sug.id : null, name, label, GROUP(label), "Standard conversation field (respond.io conversations export, 1 Nov 2026)." + (/summary|reason/i.test(label) ? " Free text: may contain personal details." : "")]);
      added++;
    }
    for (const [sec, ref, severity, title, detail] of ISSUES)
      if (!(await client.query("SELECT 1 FROM issues WHERE title=$1", [title])).rowCount) await client.query("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ($1,$2,$3,$4,$5)", [sec, ref, title, detail, severity]);
    await client.query("INSERT INTO meta (key,value) VALUES ('seeded_v18',$1)", [new Date().toISOString()]);
    await client.query("COMMIT");
    console.log(`Applied respond.io conversation fields v18 (${added} items).`);
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
module.exports = { seedV18 };
