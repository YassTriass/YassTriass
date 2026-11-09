// Generates assets/terminal.svg: an animated "SOC terminal" for the GitHub profile README.
// GitHub strips JavaScript from READMEs, but CSS animations inside an SVG <img> still play,
// so this script computes the timeline in TypeScript and bakes it into CSS keyframes.
//
// Run: npx tsx scripts/generate-animation.ts

import { mkdirSync, writeFileSync } from "node:fs";

// ---------- types ----------
type Seg = { text: string; cls: string }; // a coloured piece of a line
type Line = { kind: "cmd" | "out"; segs: Seg[] }; // "cmd" lines get typed, "out" lines pop in

// ---------- layout + timing settings ----------
const WIDTH = 780;
const CHAR_W = 8.6; // approx width of one 14px monospace character
const LINE_H = 22;
const PAD_X = 20;
const TOP = 62; // y of first baseline (below the title bar)
const TYPE_SPEED = 0.055; // seconds per typed character
const PAUSE_AFTER_CMD = 0.45; // pause before a command's output appears
const OUT_GAP = 0.3; // gap between output lines
const HOLD = 4; // seconds the finished screen stays before looping

// ---------- content ----------
const s = (text: string, cls = "o"): Seg => ({ text, cls });
const PROMPT = s("trias@soc-lab:~$ ", "p");
const cmd = (t: string): Line => ({ kind: "cmd", segs: [PROMPT, s(t, "c")] });
const out = (...segs: Seg[]): Line => ({ kind: "out", segs });

const lines: Line[] = [
  cmd("whoami"),
  out(s("Trias", "h"), s(" · aspiring SOC Analyst · CS @ BINUS University")),
  cmd("cat focus.txt"),
  out(s("[SIEM] ", "g"), s("Wazuh, Splunk   "), s("[Backend] ", "b"), s("Kotlin/Ktor   "), s("[Automation] ", "y"), s("n8n")),
  cmd("tail -f /var/ossec/logs/alerts/alerts.log"),
  out(s("rule 5710 ", "y"), s("sshd: login attempt with non-existent user   "), s("lvl 5", "y")),
  out(s("evt  4625 ", "r"), s("multiple failed logons detected → alert fired  "), s("lvl 10", "r")),
  out(s("rule 550  ", "b"), s("FIM: integrity checksum changed /etc/passwd    "), s("lvl 7", "b")),
  out(s("✔ ", "g"), s("triaged, mapped to MITRE ATT&CK T1110 (Brute Force)")),
];

// ---------- helpers ----------
const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const lenOf = (l: Line) => l.segs.reduce((n, sg) => n + [...sg.text].length, 0);

// ---------- build the timeline (start/end time of each line, in seconds) ----------
let t = 0.6;
const timeline = lines.map((line) => {
  const start = t;
  if (line.kind === "cmd") {
    const typed = [...line.segs[1].text].length;
    const end = start + typed * TYPE_SPEED;
    t = end + PAUSE_AFTER_CMD;
    return { start, end, typed };
  }
  t = start + OUT_GAP;
  return { start, end: start, typed: 0 };
});
const cursorAt = t; // final prompt + blinking cursor appear here
const TOTAL = cursorAt + HOLD; // one full loop

const pct = (sec: number) => ((sec / TOTAL) * 100).toFixed(3) + "%";

// ---------- CSS: each line is hidden by a "cover" rect that slides right to reveal it ----------
const css: string[] = [];
const covers: string[] = [];
const texts: string[] = [];

lines.forEach((line, i) => {
  const y = TOP + i * LINE_H;
  const total = lenOf(line);
  const coverW = total * CHAR_W + 24;
  const { start, end, typed } = timeline[i];

  if (line.kind === "cmd") {
    const promptW = [...PROMPT.text].length * CHAR_W;
    // prompt appears instantly, then the command is "typed" one char per step
    css.push(`@keyframes k${i}{
  0%,${pct(start)}{transform:translateX(0)}
  ${pct(start + 0.01)}{transform:translateX(${promptW}px);animation-timing-function:steps(${typed},end)}
  ${pct(end)},99.5%{transform:translateX(${coverW}px)}
  100%{transform:translateX(0)}
}`);
  } else {
    css.push(`@keyframes k${i}{
  0%,${pct(start)}{transform:translateX(0)}
  ${pct(start + 0.01)},99.5%{transform:translateX(${coverW}px)}
  100%{transform:translateX(0)}
}`);
  }
  css.push(`.k${i}{animation:k${i} ${TOTAL.toFixed(2)}s linear infinite}`);

  const spans = line.segs.map((sg) => `<tspan class="${sg.cls}">${esc(sg.text)}</tspan>`).join("");
  texts.push(`<text x="${PAD_X}" y="${y}" xml:space="preserve">${spans}</text>`);
  covers.push(`<rect class="k${i}" x="${PAD_X - 2}" y="${y - 16}" width="${coverW}" height="${LINE_H}" fill="#0d1117"/>`);
});

// final prompt line with blinking cursor
const lastY = TOP + lines.length * LINE_H;
const cursorX = PAD_X + [...PROMPT.text].length * CHAR_W;
css.push(`@keyframes show{0%,${pct(cursorAt)}{opacity:0}${pct(cursorAt + 0.01)},99.5%{opacity:1}100%{opacity:0}}
.show{animation:show ${TOTAL.toFixed(2)}s linear infinite}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
.blink{animation:blink 1s step-end infinite}`);

const HEIGHT = lastY + 26;

// ---------- assemble the SVG ----------
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Animated terminal: Trias, aspiring SOC Analyst, triaging Wazuh alerts">
<style>
text{font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;font-size:14px}
.p{fill:#3fb950;font-weight:bold}.c{fill:#e6edf3}.o{fill:#8b949e}.h{fill:#e6edf3;font-weight:bold}
.g{fill:#3fb950}.b{fill:#58a6ff}.y{fill:#d29922}.r{fill:#f85149}
${css.join("\n")}
</style>
<rect width="${WIDTH}" height="${HEIGHT}" rx="10" fill="#0d1117" stroke="#30363d"/>
<path d="M0 10a10 10 0 0 1 10-10h${WIDTH - 20}a10 10 0 0 1 10 10v22H0z" fill="#161b22"/>
<circle cx="20" cy="16" r="6" fill="#ff5f56"/><circle cx="40" cy="16" r="6" fill="#ffbd2e"/><circle cx="60" cy="16" r="6" fill="#27c93f"/>
<text x="${WIDTH / 2}" y="21" text-anchor="middle" class="o" style="font-size:12px">trias@soc-lab — wazuh alerts</text>
${texts.join("\n")}
${covers.join("\n")}
<g class="show"><text x="${PAD_X}" y="${lastY}" xml:space="preserve"><tspan class="p">${esc(PROMPT.text)}</tspan></text>
<rect class="blink" x="${cursorX}" y="${lastY - 13}" width="8" height="16" fill="#e6edf3"/></g>
</svg>
`;

mkdirSync("assets", { recursive: true });
writeFileSync("assets/terminal.svg", svg);
console.log(`assets/terminal.svg written (${lines.length} lines, ${TOTAL.toFixed(1)}s loop)`);
