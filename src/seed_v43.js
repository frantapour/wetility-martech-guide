// v43: Clarity mobile tap export for the home page (30 Oct to 1 Nov 2026).
const { q } = require("./db");
const T = "Mobile home page: 13% of taps land on the hero image, which is not a link";
const D = "Clarity tap export, mobile, www.wetility.energy home page, 30 Oct to 1 Nov 2026: 3,601 page views, 1,159 taps. By area: hero buttons 23%; hero background (not clickable) 13%; bundle cards 29% in total (card body 12%, product image 6%, spec pills 5%, Subscribe or price button 5%); menu button 10%; menu links 6%; top-right header buttons 7%; footer 1%. One in eight taps hits the hero picture and does nothing: make the hero itself open bundle selection or 'Help me choose'. Only 5% of taps reach a Subscribe button, so the bundle card, not the button, is how people choose: keep the whole card clickable and make the price and bill range readable on the card. Note: masking hides prices and bill ranges in Clarity heatmaps, so dashes there are masking, not missing content.";
async function seedV43() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v43'")).rowCount) return;
  if (!(await q("SELECT 1 FROM issues WHERE title=$1", [T])).rowCount)
    await q("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ('pb42','Website',$1,$2,'medium')", [T, D]);
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v43',$1)", [new Date().toISOString()]);
  console.log("Applied Clarity mobile taps v43.");
}
module.exports = { seedV43 };
