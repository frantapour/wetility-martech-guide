// Guards the shared plan data: a missing comma between rows silently breaks the app.
const vm = require("vm"), fs = require("fs");
const P = vm.runInNewContext(fs.readFileSync(__dirname + "/../public/plan.js", "utf8") + ";({ GAPS, ACCESS, ACTIONS })");
const bad = [];
P.ACTIONS.forEach((a, i) => { if (!Array.isArray(a) || a.length !== 6 || !/^\d{4}-\d\d-\d\d$/.test(a[1])) bad.push("ACTIONS row " + i); });
P.GAPS.forEach((g, i) => { if (!Array.isArray(g) || g.length !== 8) bad.push("GAPS row " + i); });
P.ACCESS.forEach((a, i) => { if (!Array.isArray(a) || a.length !== 4) bad.push("ACCESS row " + i); });
if (bad.length) { console.error("Plan data malformed: " + bad.join(", ")); process.exit(1); }
