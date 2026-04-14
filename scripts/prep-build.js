// Strip .next/ entries from tsconfig include before Vercel build.
// Next.js re-adds them cleanly; without this it doubles the path (dev/dev/…) and hangs.
const fs = require("fs");
const t = JSON.parse(fs.readFileSync("tsconfig.json", "utf8"));
t.include = (t.include || []).filter((p) => !p.startsWith(".next/"));
t.exclude = [...new Set([...(t.exclude || []), ".next"])];
fs.writeFileSync("tsconfig.json", JSON.stringify(t, null, 2));
