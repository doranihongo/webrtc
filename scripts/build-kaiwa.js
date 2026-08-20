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

// Re-install whenever node_modules is missing OR stale relative to
// package-lock.json - the latter catches a `git pull` that brought in a
// new/updated dependency (e.g. a fresh entry in kaiwa/package.json) into an
// already-existing node_modules from a previous deploy, which used to
// silently skip npm install here and fail later at Vite's import-resolution
// step instead. Compared against node_modules/.package-lock.json (which npm
// itself rewrites at the end of every successful install to mirror exactly
// what got installed) rather than the node_modules directory's own mtime -
// more reliable, since plain directory mtime doesn't always bump when only
// nested sub-packages change.
const nodeModulesDir = path.join(kaiwaDir, "node_modules");
const installedLockMarker = path.join(nodeModulesDir, ".package-lock.json");
const lockfilePath = path.join(kaiwaDir, "package-lock.json");
const nodeModulesMissing = !fs.existsSync(nodeModulesDir);
const installIsStale =
  !nodeModulesMissing &&
  fs.existsSync(lockfilePath) &&
  (!fs.existsSync(installedLockMarker) ||
    fs.statSync(lockfilePath).mtimeMs > fs.statSync(installedLockMarker).mtimeMs);

if (nodeModulesMissing || installIsStale) {
  console.log(
    nodeModulesMissing
      ? "[build:kaiwa] kaiwa/node_modules missing, running npm install first..."
      : "[build:kaiwa] kaiwa/package-lock.json changed since the last install, running npm install first...",
  );
  execSync("npm install", { cwd: kaiwaDir, stdio: "inherit" });
}

console.log("[build:kaiwa] Building kaiwa (vite build)...");
execSync("npm run build", { cwd: kaiwaDir, stdio: "inherit" });

console.log("[build:kaiwa] Copying kaiwa/dist -> public/kaiwa ...");
fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(kaiwaDist, target, { recursive: true });

console.log("[build:kaiwa] Done.");
