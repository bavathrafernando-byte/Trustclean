import fs from "node:fs";
import path from "node:path";

function fileExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readDirSafe(p) {
  return fs.existsSync(p) ? fs.readdirSync(p) : [];
}

const distClientDir = path.join(process.cwd(), "dist", "client");
const assetsDir = path.join(distClientDir, "assets");
const publicDir = path.join(process.cwd(), "public");

const cssCandidates = readDirSafe(assetsDir).filter((f) => /^styles-.*\.css$/.test(f));
const jsCandidates = readDirSafe(assetsDir).filter((f) => /^index-.*\.js$/.test(f));

if (cssCandidates.length === 0) {
  console.error(`[prepare-netlify-entry] No styles-*.css found in ${assetsDir}`);
  process.exit(1);
}
if (jsCandidates.length === 0) {
  console.error(`[prepare-netlify-entry] No index-*.js found in ${assetsDir}`);
  process.exit(1);
}

// Pick the JS bundle that actually hydrates React into `document`.
// This avoids hardcoding the hashed file name in index.html.
let entryJsFile = null;
for (const f of jsCandidates) {
  const full = path.join(assetsDir, f);
  const contents = fs.readFileSync(full, "utf8");
  if (contents.includes("hydrateRoot(document")) {
    entryJsFile = f;
    break;
  }
}

// Fallback if the exact marker isn't found for some reason.
if (!entryJsFile) entryJsFile = jsCandidates[0];

const entryCssFile = cssCandidates[0];

const entryJsPath = path.join(assetsDir, entryJsFile);
const entryCssPath = path.join(assetsDir, entryCssFile);

const stableJs = path.join(assetsDir, "entry.js");
const stableCss = path.join(assetsDir, "entry.css");

if (!fileExists(entryJsPath)) {
  console.error(`[prepare-netlify-entry] entry JS missing: ${entryJsPath}`);
  process.exit(1);
}
if (!fileExists(entryCssPath)) {
  console.error(`[prepare-netlify-entry] entry CSS missing: ${entryCssPath}`);
  process.exit(1);
}

fs.copyFileSync(entryJsPath, stableJs);
fs.copyFileSync(entryCssPath, stableCss);

// Ensure Netlify SPA fallback is present in the publish dir on clean builds.
const redirectsSrc = path.join(publicDir, "_redirects");
const redirectsDest = path.join(distClientDir, "_redirects");
if (fileExists(redirectsSrc)) {
  fs.copyFileSync(redirectsSrc, redirectsDest);
} else {
  console.warn(`[prepare-netlify-entry] Missing public/_redirects; skipping copy`);
}

// Keep a deterministic static HTML entry for Netlify.
const indexSrc = path.join(publicDir, "index.html");
const indexDest = path.join(distClientDir, "index.html");
if (fileExists(indexSrc)) {
  fs.copyFileSync(indexSrc, indexDest);
} else {
  console.warn(`[prepare-netlify-entry] Missing public/index.html; skipping copy`);
}

console.log(
  `[prepare-netlify-entry] Created ${path.posix.join(
    "dist/client/assets",
    "entry.js"
  )} + ${path.posix.join("dist/client/assets", "entry.css")} from ${entryJsFile} + ${entryCssFile}`
);

