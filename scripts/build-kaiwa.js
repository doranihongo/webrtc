/**
 * Build step: run `vite build` inside kaiwa/ (React/Vite kaiwa app, lives as
 * its own sub-project with its own package.json/node_modules) then copy the
 * output into public/kaiwa/, which is what the server actually serves
 * (see the "/" route in app/src/server.js).
 *
 * public/kaiwa/ is cleared and replaced wholesale each run, since Vite
 * hashes asset filenames per build and a plain overwrite-copy would leave
 * stale hashed files behind otherwise.
 *
 * Run with: npm run build:kaiwa
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const kaiwaDir = path.join(__dirname, "..", "kaiwa");
const kaiwaDist = path.join(kaiwaDir, "dist");
const target = path.join(__dirname, "..", "public", "kaiwa");

if (!fs.existsSync(path.join(kaiwaDir, "node_modules"))) {
  console.log("[build:kaiwa] kaiwa/node_modules missing, running npm install first...");
  execSync("npm install", { cwd: kaiwaDir, stdio: "inherit" });
}

console.log("[build:kaiwa] Building kaiwa (vite build)...");
execSync("npm run build", { cwd: kaiwaDir, stdio: "inherit" });

console.log("[build:kaiwa] Copying kaiwa/dist -> public/kaiwa ...");
fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(kaiwaDist, target, { recursive: true });

console.log("[build:kaiwa] Done.");
