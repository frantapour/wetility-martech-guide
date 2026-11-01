// v38: TikTok Direct Messages automatic messaging, 1 Nov 2026.
const { q } = require("./db");
const T = "TikTok DMs invite pricing questions, but nobody is known to answer them and they never reach the CRM";
const D = "Business Center > Direct Messages: chat prompts on ('Learn more', 'Get in touch', 'Check pricing') and the welcome message on; keyword reply and suggested questions off. The TikTok inbox is not connected to respond.io or Freshsales, so a pricing question is a lead that is not counted, not attributed and may not be answered. Steps: (1) check the Inbox for unanswered messages and name an owner; (2) make the welcome message hand over to WhatsApp (+27 83 386 6110) with a 'TikTok' reference, so the conversation lands in respond.io; (3) check whether respond.io can connect TikTok messaging; (4) count TikTok DMs as a lead source in the baseline (A12).";
async function seedV38() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v38'")).rowCount) return;
  if (!(await q("SELECT 1 FROM issues WHERE title=$1", [T])).rowCount)
    await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ('pb42','Step 3',$1,$2,'medium')", [T, D]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v38',$1)", [new Date().toISOString()]);
  console.log("Applied TikTok messaging v38.");
}
module.exports = { seedV38 };
