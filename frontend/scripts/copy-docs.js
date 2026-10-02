// How docs are published: the repo-root docs/ folder is the source of truth.
// This prebuild step copies docs/*.html into public/docs/ (gitignored), and
// frontend/vercel.json serves them at /docs. The app code never reads them.
const fs = require("fs");
const path = require("path");

const source = path.resolve(__dirname, "../../docs");
const dest = path.resolve(__dirname, "../public/docs");

if (!fs.existsSync(source)) {
  console.error("copy-docs: missing " + source);
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

const htmlFiles = fs.readdirSync(source).filter((name) => name.endsWith(".html"));
if (htmlFiles.length === 0) {
  console.error("copy-docs: no HTML files in " + source);
  process.exit(1);
}

// Published docs must not name the retired builder. Fix the page in docs/
// (regenerate diagrams from docs/specs/) instead of patching the copy.
const retiredVendor = /emergent/i;
const offenders = htmlFiles.filter((name) =>
  retiredVendor.test(fs.readFileSync(path.join(source, name), "utf8"))
);
if (offenders.length > 0) {
  console.error("copy-docs: retired vendor name found in docs/: " + offenders.join(", "));
  process.exit(1);
}

for (const name of htmlFiles) {
  fs.copyFileSync(path.join(source, name), path.join(dest, name));
}

console.log("copy-docs: copied " + htmlFiles.length + " HTML files into public/docs");
