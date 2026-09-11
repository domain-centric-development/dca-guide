// Every ```mermaid block in the guide must parse.
//
// A broken diagram is invisible until someone opens the page: GitHub renders a
// red box where the picture should be, and the build that produced it stayed
// green. The parser is the only thing that knows. One trap is worth naming
// because nothing about it looks wrong in a diff: inside a sequence diagram a
// semicolon ends the statement, so a Note containing one is a syntax error.
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

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

for (const { file, line, message } of broken) console.error(`${file}:${line}\n   ${message}\n`);
console.log(`mermaid: ${checked} diagrams checked, ${broken.length} broken`);
process.exit(broken.length ? 1 : 0);
