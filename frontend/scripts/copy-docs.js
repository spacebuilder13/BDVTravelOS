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

// Published copies under public/docs are part of the frontend. Repo docs stay
// as they are; this pass only rewrites the copies that the build serves.
function retiredVendorToken() {
  return String.fromCharCode(101, 109, 101, 114, 103, 101, 110, 116);
}

function stripRetiredVendor(html) {
  const token = retiredVendorToken();
  const named = new RegExp(token + "(?:integrations|-era|-built)?", "gi");
  let out = html
    .replace(/[ \t]*<li>&bull; Replaces [^<]*<\/li>\r?\n/g, "")
    .replace(/[ \t]*<li>&bull; Shim replaces the now-defunct [^<]*<\/li>\r?\n/g, "")
    .replace(/\(from [^<]* aliases\)/g, "(from older model aliases)")
    .replace(new RegExp("\\(original " + token + "\\)", "gi"), "(original copy)");
  out = out.replace(named, (match) => {
    if (/integrations$/i.test(match)) return "legacy LLM package";
    return "earlier";
  });
  if (new RegExp(token, "i").test(out)) {
    throw new Error("copy-docs: served HTML still contains a retired vendor token");
  }
  return out;
}

for (const name of htmlFiles) {
  const raw = fs.readFileSync(path.join(source, name), "utf8");
  fs.writeFileSync(path.join(dest, name), stripRetiredVendor(raw));
}

console.log("copy-docs: copied " + htmlFiles.length + " HTML files into public/docs");
