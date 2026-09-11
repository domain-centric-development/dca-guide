// Two checks over the guide's own documents.
//
// 1. Every ```mermaid block must parse.
// 2. Box-drawing characters may only appear inside a ```text fence.
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

const stray = strayBoxArt(root);

for (const { file, line, message } of broken) console.error(`${file}:${line}\n   ${message}\n`);
for (const { file, line, where } of stray) {
  const place = where === "prose" ? "prose" : "a " + where + " fence";
  console.error(`${file}:${line}\n   box-drawing characters in ${place} — a tree belongs in a text fence, a structural diagram in mermaid\n`);
}
console.log(`mermaid: ${checked} diagrams checked, ${broken.length} broken · box art: ${stray.length} stray`);
process.exit(broken.length || stray.length ? 1 : 0);
