// 合并「大纲词汇网页版」词书 + 「真题词频统计」→ vocab-data.js
// 用法: node build/合并词书数据.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = path.resolve(__dirname, "..", "..", "考研英语大纲词汇网页版");
const FREQ_CSV = path.resolve(__dirname, "..", "..", "考研英语真题词汇词频统计", "生成结果", "真题高频词汇.csv");
const OUT = path.resolve(__dirname, "..", "vocab-data.js");

// ---- 1. 读词书（在沙箱里执行各 JS 文件收集 UNITS / EXTRA） ----
const ctx = { console };
ctx.window = ctx; // 模拟浏览器: window 即全局, UNITS/EXTRA 挂上后即为裸全局变量
vm.createContext(ctx);
const run = (f) => vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
run(path.join(SRC, "data.js"));
for (const f of fs.readdirSync(path.join(SRC, "units")).sort()) run(path.join(SRC, "units", f));
run(path.join(SRC, "extra.js"));
const UNITS = ctx.window.UNITS, EXTRA = ctx.window.EXTRA;

// ---- 2. 读词频 CSV ----
const freq = new Map();
const csv = fs.readFileSync(FREQ_CSV, "utf8").replace(/^\uFEFF/, "");
for (const line of csv.split(/\r?\n/).slice(1)) {
  const m = line.match(/^([^,]+),([^,]+),(\d+),(\d+),(.*)$/);
  if (m) freq.set(m[1].toLowerCase(), { f: +m[3], y: +m[4], indagang: m[2] === "大纲内" });
}

// ---- 3. 融合 ----
const entries = [];
const seen = new Set();
for (const u of UNITS) for (const s of u.sections) for (const w of s.w) {
  const word = w[0];
  const key = word.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  const ex = EXTRA[word] || EXTRA[key] || {};
  const fr = freq.get(key);
  entries.push({
    w: word, tag: u.tag, unit: u.name, sid: u.id,
    mean: w[1], etym: w[2] || "", rel: w[3] || "",
    syn: ex.syn || "", senses: ex.senses || "", warn: ex.warn || "",
    ex: ex.ex || "", exZh: ex.exZh || "",
    f: fr ? fr.f : 0, y: fr ? fr.y : 0,
  });
}
entries.sort((a, b) => b.f - a.f || a.w.localeCompare(b.w));
entries.forEach((e, i) => (e.rank = i + 1));

// ---- 4. 补齐词书缺失的大纲词（取自 5495大纲词汇.txt） ----
const dagangRaw = fs.readFileSync(path.resolve(__dirname, "..", "..", "考研英语真题词汇词频统计", "data", "5495大纲词汇.txt"));
let dagangText;
try { dagangText = dagangRaw.toString("utf8"); }
catch { dagangText = dagangRaw.toString("latin1"); }
if (/\ufffd/.test(dagangText) || !/一/.test(dagangText)) {
  dagangText = new TextDecoder("gbk").decode(dagangRaw); // GBK 编码
}
const dagangMean = new Map();
for (const line of dagangText.split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z][A-Za-z'\-]*)[\t ]+(.+)$/);
  if (m && !dagangMean.has(m[1].toLowerCase())) dagangMean.set(m[1].toLowerCase(), m[2].trim());
}
let added = 0;
for (const [w, d] of freq) {
  if (d.indagang && d.f >= 8 && !seen.has(w) && dagangMean.has(w)) {
    seen.add(w);
    added++;
    entries.push({ w, tag: "大纲补充", unit: "", sid: "sup", mean: dagangMean.get(w), etym: "", rel: "", syn: "", senses: "", warn: "", ex: "", exZh: "", f: d.f, y: d.y });
  }
}
entries.sort((a, b) => b.f - a.f || a.w.localeCompare(b.w));
entries.forEach((e, i) => (e.rank = i + 1));
console.log(`补充大纲词(词频≥8): ${added} 条`);

// ---- 5. 报告 ----
const byTag = {};
for (const e of entries) byTag[e.tag] = (byTag[e.tag] || 0) + 1;
console.log("词条总数:", entries.length, "| 分布:", JSON.stringify(byTag, null, 0));
const hit = entries.filter((e) => e.f > 0).length;
console.log(`词频覆盖: ${hit}/${entries.length} 条词条在真题中出现过`);
const topMissing = [];
for (const [w, d] of freq) if (!seen.has(w) && d.f >= 30) topMissing.push(`${w}(${d.f})`);
console.log("高频但词书未收录(词频≥30):", topMissing.slice(0, 30).join(", ") || "无");

fs.writeFileSync(OUT, "// 由 合并词书数据.js 生成: 词书内容 + 1980-2026 真题词频\nwindow.VOCAB = " + JSON.stringify(entries) + ";\n", "utf8");
console.log("已写出", OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + "KB");
