// v6: Freshsales product catalogue findings (31 Oct 2026).
const { q, pool } = require("./db");
async function seedV6() {
  const done = await q("SELECT value FROM meta WHERE key='seeded_v6'");
  if (done.rowCount) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ex = await client.query("SELECT 1 FROM impls WHERE system='freshsales' AND container='Product catalog' AND name='product_catalog'");
    if (!ex.rowCount) await client.query(`INSERT INTO impls (field_id,system,container,kind,name,label,std,state,description) VALUES ('product_interest','freshsales','Product catalog','product','product_catalog','Product catalogue (307 products)',TRUE,'live',$1)`, [
      "307 products. The PACE range carries SKUs (e.g. PC-1P-080SP-150S-PBB) and product codes (PACE_MAXI, PACE_MAXI_OUTDOOR, PACE_MEDI, PACE_MEGA, PACE_MINI, PACE_MONO, PACE_BACKUP, PACE_CORE). These product codes are the values product_interest should carry on the website, in the chatbot and on deals. LIFT and LUXE carry LF-/LX- SKUs; some LIFT products have codes (LIFT_15, LIFT_50). Many other active products have no SKU, product code or category."]);
    await client.query(`UPDATE fields SET description=$1 WHERE id='product_interest' AND updated_by IS NULL`, [
      "Product the lead asked about. Values must be Freshsales product codes (for example PACE_MAXI, PACE_MAXI_OUTDOOR, LIFT_50) so web, chatbot and deal data join on the same product."]);
    const t = "Freshsales product catalogue: several active versions per package, legacy 'Beast Bundle' and 'Workaround' products, missing product codes";
    const ex2 = await client.query("SELECT 1 FROM issues WHERE title=$1", [t]);
    if (!ex2.rowCount) await client.query("INSERT INTO issues (sec,ref,title,detail,severity) VALUES ('pb45','General',$1,$2,'medium')", [t,
      "Checked 31 Oct 2026 (307 products). PACE packages exist in several active variants each (PBB, PBB-OD outdoor, 3PH, 'Workaround', '-OLD'), plus near-duplicates such as 'Pace medi'. Some products still sit in a 'Beast Bundle' category (the legacy naming also found on the website). Many active subscription and add-on products have no SKU, product code or category; some 'monthly subscription amount' values look like prices or placeholders (1, 5, 10, 1,384,922). Products were created by users now deactivated. Proposed: one active product per sellable package with a product code, retire Workaround/OLD/Beast Bundle items, and use the product code as the product_interest value everywhere."]);
    await client.query("INSERT INTO meta (key,value) VALUES ('seeded_v6',$1)", [new Date().toISOString()]);
    await client.query("COMMIT");
    console.log("Applied product catalogue findings v6.");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
module.exports = { seedV6 };
