// v4: corrections after checking Freshsales > Integrate Social Media with CRM on 31 Oct 2026.
// Facts: 1 connected account (Kopano Boikanyo, personal Yahoo, 13 May 2026); 2 pages both named "Wetility"; no ad accounts; no lead gen forms.
// Articles are only corrected if nobody has edited them in the app yet; the issue is updated in place.
const { q, pool } = require("./db");

async function seedV4() {
  const done = await q("SELECT value FROM meta WHERE key='seeded_v4'");
  if (done.rowCount) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE kb SET title=$1, summary=$2, steps=$3, changes=$4, verified_on='2026-10-31', verified_by='Checked in Freshsales'
      WHERE id='native-meta-leadforms' AND updated_by IS NULL`, [
      "Native: Meta Instant Forms to Freshsales (not in use today)",
      "Freshsales can import Meta lead-form leads natively, and those leads can then send CRM stages back to Meta (Conversion Leads). As of 31 Oct 2026 no lead forms are connected in Freshsales, so this route is not in use. The Meta Lead ID field exists in Freshsales; confirm whether anything fills it.",
      JSON.stringify([
        "Check whether the Freshsales 'Meta Lead ID' field has any values (filter contacts where it is not empty). If it does, find out what fills it (Zapier, LeadsBridge or another agency tool) and record that integration and its owner.",
        "If Wetility runs Meta Instant Forms in future: connect them in Freshsales > Integrate Social Media with CRM > Forms, from a Wetility-owned Meta account with two admins.",
        "Then send each stage change for those leads to the Wetility dataset: action_source = system_generated, custom_data.event_source = crm, custom_data.lead_event_source = Freshsales, lead_id, event_time within 7 days, all stages in order.",
        "Use neutral milestone names; never send credit outcomes (for example Credit Check > Qualified) without Information Officer approval."]),
      JSON.stringify(["Corrected 31 Oct 2026: an earlier version assumed lead forms flow through this connection. None are connected."])]);
    await client.query(`UPDATE kb SET steps = (
        SELECT jsonb_agg(CASE WHEN value::text LIKE '%Freshsales social integration for Meta Instant Form leads%'
          THEN to_jsonb('NOT IN USE: Freshsales social integration for Meta Instant Form leads. No forms are connected (checked 31 Oct 2026); only two Wetility pages are linked, through a former agency person''s account.'::text) ELSE value END)
        FROM jsonb_array_elements(steps)),
      changes = (SELECT jsonb_agg(CASE WHEN value::text LIKE '%Wetility appears to run Meta Instant Forms%'
          THEN to_jsonb('Corrected 31 Oct 2026: Meta Conversion Leads applies only if Wetility runs Instant Forms; none are connected in Freshsales today.'::text) ELSE value END)
        FROM jsonb_array_elements(changes))
      WHERE id='native-overview' AND updated_by IS NULL`);
    await client.query(`UPDATE kb SET summary=$1 WHERE id='meta-crm-leads' AND updated_by IS NULL`, [
      "Meta's Conversion Leads integration (CRM stages sent back through Conversions API with action_source = system_generated) supports only native Lead Ads (Instant Forms). No Instant Forms are connected in Freshsales today (checked 31 Oct 2026), so it does not apply unless that changes; website and WhatsApp leads use the other routes."]);
    await client.query(`UPDATE issues SET severity='medium',
      title='Freshsales is linked to both Wetility pages through a former agency person''s personal account',
      detail=$1 WHERE sec='pb41' AND title LIKE 'Freshsales social media integration%' AND state='open'`, [
      "Checked 31 Oct 2026 in Freshsales > Integrate Social Media with CRM: one connected account (Kopano Boikanyo, personal Yahoo address, connected 13 May 2026), two pages both named Wetility (likely Facebook and Instagram), no ad accounts, no lead gen forms. No lead flow depends on it, but that login can post to both pages from Freshsales. Fix: remove the account from Freshsales (reconnect under a Wetility admin only if the team posts from Freshsales), then check Meta Business Settings > Pages > People and Partners for any remaining agency access."]);
    await client.query(`UPDATE impls SET description=$1 WHERE system='freshsales' AND name='social_media_integration'`, [
      "Connected 13 May 2026 by Kopano Boikanyo (former DarkMatter agency) using a personal Yahoo account. Linked: 2 pages named Wetility. Ad accounts: none. Lead forms: none (checked 31 Oct 2026)."]);
    await client.query("INSERT INTO meta (key,value) VALUES ('seeded_v4',$1)", [new Date().toISOString()]);
    await client.query("COMMIT");
    console.log("Applied corrections v4.");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
module.exports = { seedV4 };
