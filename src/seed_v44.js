// v44: team change (Franta, 2 Nov 2026): Timothy (Permutable) removed; his items move to Thato. Thato and Raneet added to the team.
const { q } = require("./db");
async function seedV44() {
  if ((await q("SELECT 1 FROM meta WHERE key='seeded_v44'")).rowCount) return;
  for (const [from, to] of [["Timothy (Permutable)", "Thato"], ["Timothy", "Thato"]]) {
    await q("UPDATE issues SET title=replace(title,$1,$2), detail=replace(detail,$1,$2) WHERE title LIKE '%'||$1||'%' OR detail LIKE '%'||$1||'%'", [from, to]);
    await q("UPDATE kb SET summary=replace(summary,$1,$2), steps=replace(steps::text,$1,$2)::jsonb, practices=replace(practices::text,$1,$2)::jsonb WHERE summary LIKE '%'||$1||'%' OR steps::text LIKE '%'||$1||'%' OR practices::text LIKE '%'||$1||'%'", [from, to]);
    await q("UPDATE impls SET description=replace(description,$1,$2) WHERE description LIKE '%'||$1||'%'", [from, to]);
  }
  await q("INSERT INTO meta (key,value) VALUES ('seeded_v44',$1)", [new Date().toISOString()]);
  console.log("Applied team change v44.");
}
module.exports = { seedV44 };
