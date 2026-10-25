const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const files = ["index.html", "assets/css/styles.css", "assets/js/app.js", "assets/js/menu-data.js", "assets/js/config.js"];
const refs = new Map();

function addRef(from, ref) {
  if (!ref || /^(?:[a-z]+:|\/\/|#|data:|mailto:|tel:)/i.test(ref)) return;
  const clean = ref.split(/[?#]/)[0];
  if (!clean) return;
  if (!refs.has(clean)) refs.set(clean, []);
  refs.get(clean).push(from);
}

for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  for (const match of text.matchAll(/(?:src|href)=["']([^"']+)["']/g)) addRef(file, match[1]);
  for (const match of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) addRef(file, match[1]);
  for (const match of text.matchAll(/["']((?:assets\/)[^"']+)["']/g)) addRef(file, match[1]);
}

const rows = [];
for (const [ref, from] of [...refs].sort()) {
  const full = path.resolve(root, ref);
  const found = fs.existsSync(full);
  let exact = false;
  if (found) {
    try {
      const dir = path.dirname(full);
      exact = fs.readdirSync(dir).includes(path.basename(full));
    } catch {}
  }
  rows.push({ ref, found, exact, from: [...new Set(from)].join(",") });
}

console.log(JSON.stringify(rows.filter((row) => !row.found || !row.exact), null, 2));
console.log(`Checked ${rows.length} local references; missing/case-mismatch: ${rows.filter((row) => !row.found || !row.exact).length}`);
