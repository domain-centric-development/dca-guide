// Four checks over the guide's own documents. Each of them catches something that
// renders without complaint and is therefore invisible in review.
//
// 1. Every ```mermaid block must parse — a broken one is a red box on GitHub.
// 2. Box-drawing characters may only appear inside a ```text fence, so a tree stays a
//    tree and a structural diagram nobody converted cannot hide in an undeclared block.
// 3. In a filesystem tree, a directory ends with a slash. Without it a reader cannot tell
//    a package from an extensionless file.
// 4. The project's own example root is one placeholder: com.company.project. A foreign package in
//    an example — the thing a rule excludes — is left alone.
//
// A broken diagram is invisible until someone opens the page: GitHub renders a
// red box where the picture should be, and the build that produced it stayed
// green. The parser is the only thing that knows. One trap is worth naming
// because nothing about it looks wrong in a diff: inside a sequence diagram a
// semicolon ends the statement, so a Note containing one is a syntax error.
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

// A fence opener/closer, seen through an optional blockquote prefix ("> ```text").
const QUOTE = /^((?:\s*>)+\s?)?(.*)$/;
const FENCE = /^(\s*)(`{3,})(.*)$/;
const BOX = /[\u2500-\u257F\u25B2\u25BC\u25C4\u25BA]/;
const ENTRY = /^[\s\u2502]*[\u251C\u2514]\u2500\u2500\s+(\S+)/;
const FILENAME = /\.[A-Za-z0-9]{1,6}$/;
const DIRNAME = /^[a-z0-9{][a-z0-9._{}*-]*$/;
// Only the project's *own* root is constrained: a package declaration, or the root line of a tree.
// A foreign package in an example ("com.company.legacy" as the thing a rule excludes) is the point.
const OWN_ROOT = /^\s*(?:package\s+)?(com\.company\.(?!project\b)[a-z][\w.]*)\s*;?\s*$/;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
for (const key of ["window", "document", "Element", "HTMLElement", "SVGElement", "DOMParser", "Node"]) {
  globalThis[key] = key === "window" ? dom.window : key === "document" ? dom.window.document : dom.window[key];
}
const mermaid = (await import("mermaid")).default;
mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });

function* diagrams(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { yield* diagrams(full); continue; }
    if (!entry.name.endsWith(".md")) continue;
    const lines = fs.readFileSync(full, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() !== "```mermaid") continue;
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== "```") j++;
      yield { file: path.relative(root, full), line: i + 1, source: lines.slice(i + 1, j).join("\n") };
      i = j;
    }
  }
}

let checked = 0;
const broken = [];
for (const { file, line, source } of diagrams(root)) {
  checked++;
  try {
    await mermaid.parse(source);
  } catch (error) {
    broken.push({ file, line, message: String(error.message).split("\n").slice(0, 3).join("\n   ") });
  }
}

// Box art that is not declared text is either an undeclared fence or a diagram nobody converted.
// Trees and tabular listings are legitimate box art — they live in a text fence and pass.
function strayBoxArt(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { found.push(...strayBoxArt(full)); continue; }
    if (!entry.name.endsWith(".md")) continue;
    let open = null;
    fs.readFileSync(full, "utf8").split("\n").forEach((raw, index) => {
      const rest = QUOTE.exec(raw)[2];
      const fence = FENCE.exec(rest);
      if (fence) {
        const info = fence[3].trim();
        if (open === null) open = { ticks: fence[2].length, info: info || "(none)" };
        else if (!info && fence[2].length >= open.ticks) open = null;
        return;
      }
      if (BOX.test(rest) && open?.info !== "text") {
        found.push({ file: path.relative(root, full), line: index + 1, where: open ? open.info : "prose" });
      }
    });
  }
  return found;
}

// A block is a filesystem tree when its entries prove it: a file extension, or a path segment.
// A list drawn with tree characters ("Tests (unit, integration)") proves nothing and is left alone.
function treeFindings(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { found.push(...treeFindings(full)); continue; }
    if (!entry.name.endsWith(".md")) continue;
    const rel = path.relative(root, full);
    const lines = fs.readFileSync(full, "utf8").split("\n");

    for (let i = 0; i < lines.length; i++) {
      const open = FENCE.exec(QUOTE.exec(lines[i])[2]);
      if (!open || open[3].trim() !== "text") continue;
      let j = i + 1;
      const body = [];
      while (j < lines.length) {
        const close = FENCE.exec(QUOTE.exec(lines[j])[2]);
        if (close && !close[3].trim() && close[2].length >= open[2].length) break;
        body.push({ line: j + 1, text: lines[j] });
        j++;
      }
      const names = body.map((b) => ENTRY.exec(b.text)).map((m) => (m ? m[1] : null));
      const proof = names.filter((n) => n && (FILENAME.test(n) || n.endsWith("/") || n.replace(/\/$/, "").includes("/"))).length;
      const isTree = proof >= 2 && proof >= names.filter(Boolean).length * 0.5;
      if (isTree) {
        body.forEach((b, k) => {
          const name = names[k];
          if (!name) return;
          const last = name.replace(/\/$/, "").split("/").pop();
          if (!name.endsWith("/") && !FILENAME.test(name) && DIRNAME.test(last)) {
            found.push({ file: rel, line: b.line, message: `directory "${name}" without a trailing slash — a reader cannot tell it from an extensionless file` });
          }
        });
      }
      i = j;
    }

    lines.forEach((line, index) => {
      const m = OWN_ROOT.exec(line);
      if (m) found.push({ file: rel, line: index + 1, message: `example package "${m[1]}" — the guide's placeholder root is com.company.project` });
    });
  }
  return found;
}

const stray = strayBoxArt(root);
const trees = treeFindings(root);

for (const { file, line, message } of broken) console.error(`${file}:${line}\n   ${message}\n`);
for (const { file, line, where } of stray) {
  const place = where === "prose" ? "prose" : "a " + where + " fence";
  console.error(`${file}:${line}\n   box-drawing characters in ${place} — a tree belongs in a text fence, a structural diagram in mermaid\n`);
}
for (const { file, line, message } of trees) console.error(`${file}:${line}\n   ${message}\n`);
console.log(`mermaid: ${checked} diagrams checked, ${broken.length} broken · box art: ${stray.length} stray · trees: ${trees.length} findings`);
process.exit(broken.length || stray.length || trees.length ? 1 : 0);
