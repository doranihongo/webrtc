/**
 * Build step: minify public/js/*.js and public/css/*.css into public/dist/,
 * mirroring the same filenames. The server (see app/src/server.js) serves
 * files from public/dist first when they exist, falling back to the
 * original public/ files otherwise — so this is purely a perf optimization
 * (smaller payloads over the wire), no markup/URL changes needed.
 *
 * Run with: npm run build
 */

const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const publicDir = path.join(__dirname, "..", "public");
const distDir = path.join(publicDir, "dist");

const targets = [
  { srcDir: path.join(publicDir, "js"), outDir: path.join(distDir, "js"), loader: "js" },
  { srcDir: path.join(publicDir, "css"), outDir: path.join(distDir, "css"), loader: "css" },
];

let totalBefore = 0;
let totalAfter = 0;

for (const { srcDir, outDir, loader } of targets) {
  if (!fs.existsSync(srcDir)) continue;
  fs.mkdirSync(outDir, { recursive: true });

  const ext = "." + loader;
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(ext));

  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const outPath = path.join(outDir, file);
    const src = fs.readFileSync(srcPath, "utf8");

    const result = esbuild.transformSync(src, {
      loader,
      minify: true,
      target: loader === "js" ? "es2018" : undefined,
      legalComments: "none",
    });

    fs.writeFileSync(outPath, result.code);

    const before = Buffer.byteLength(src, "utf8");
    const after = Buffer.byteLength(result.code, "utf8");
    totalBefore += before;
    totalAfter += after;

    const pct = before > 0 ? (100 - (after / before) * 100).toFixed(1) : "0.0";
    console.log(
      `  ${path.relative(publicDir, srcPath)} -> dist/${loader}/${file}  ` +
        `${(before / 1024).toFixed(1)}KB -> ${(after / 1024).toFixed(1)}KB (-${pct}%)`,
    );
  }
}

const totalPct = totalBefore > 0 ? (100 - (totalAfter / totalBefore) * 100).toFixed(1) : "0.0";
console.log(
  `\nBuild done: ${(totalBefore / 1024).toFixed(0)}KB -> ${(totalAfter / 1024).toFixed(0)}KB (-${totalPct}%)`,
);
