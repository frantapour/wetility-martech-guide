// v24: TikTok says pixel ownership can move only once in a pixel's life; D0ESSGJC77U75NH4NU60 already moved (Growth Charter to DarkMatter).
const { q } = require("./db");
async function seedV24() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v24'")).rowCount) return;
  await q("UPDATE issues SET detail=$2 WHERE title=$1", ["TikTok pixel D0ESSGJC77U75NH4NU60 is owned by DarkMatter Marketing",
    "The pixel page shows 'Business Center owner: DarkMatter Marketing'. TikTok confirmed (1 Nov 2026) that a pixel's ownership can move only once, and this pixel already moved from Growth Charter to DarkMatter, so it can never be owned by Wetility. It holds all the learning (about 42,000 events) and the server Lead feed. Plan (gap G23): create a pixel in the Wetility Energy Business Center (7696451525908004916), run it in parallel in GTM through Black Friday (report only), rebuild key audiences on it, and move campaigns to it after 19 January one step at a time. Until then keep Admin-level access on the shared pixel and get DarkMatter's written agreement not to remove Wetility's access or change the pixel without notice. Lesson for every platform: new pixels, datasets and ad accounts are created only in Wetility-owned accounts, never by an agency."]);
  await q("UPDATE impls SET description = description || ' Ownership cannot be transferred again (TikTok, 1 Nov 2026): already moved once from Growth Charter to DarkMatter.' WHERE system='tiktok' AND name='D0ESSGJC77U75NH4NU60' AND description NOT LIKE '%cannot be transferred again%'");
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v24',$1)", [new Date().toISOString()]);
  console.log("Applied TikTok ownership limit v24.");
}
module.exports = { seedV24 };
