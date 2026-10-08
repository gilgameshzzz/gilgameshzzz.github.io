#!/usr/bin/env node
/**
 * 终极体检:在构建产物 dist/ 里全量搜索每篇草稿的特征串。
 * 命中即说明明文漏进了产物 —— 构建失败,别部署。
 *
 * 跑在 `pnpm seal` 的最后一步。CI 上没有 private/,这个脚本会自动跳过
 * (CI 本来也不可能有明文,它连草稿都没有)。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRAFTS_DIR = path.join(ROOT, "private", "drafts");
const DIST = path.join(ROOT, "dist");

if (!fs.existsSync(DRAFTS_DIR)) {
	console.log("[assert-no-plaintext] 没有 private/drafts/，跳过。");
	process.exit(0);
}
if (!fs.existsSync(DIST)) {
	console.error("[assert-no-plaintext] dist/ 不存在，先构建。");
	process.exit(1);
}

/** 从正文里挑几段有辨识度的连续文本当探针。
    跳过 front-matter、空行、markdown 语法行,取够长的普通段落。 */
function probesFor(raw) {
	const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
	const lines = body
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(
			(l) =>
				l.length >= 40 &&
				!l.startsWith("#") &&
				!l.startsWith("|") &&
				!l.startsWith("```") &&
				!l.startsWith("<!--"),
		);
	if (lines.length === 0) return [];
	// 头、中、尾各取一条,每条截 40 字
	const pick = [lines[0], lines[Math.floor(lines.length / 2)], lines.at(-1)];
	return [...new Set(pick)].map((l) => l.slice(0, 40));
}

function walk(dir) {
	const out = [];
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) out.push(...walk(p));
		else out.push(p);
	}
	return out;
}

const TEXTUAL = /\.(html|js|css|json|xml|txt|map)$/i;
const distFiles = walk(DIST).filter((f) => TEXTUAL.test(f));

const hits = [];
let probeCount = 0;

for (const file of fs.readdirSync(DRAFTS_DIR).filter((f) => f.endsWith(".md"))) {
	const raw = fs.readFileSync(path.join(DRAFTS_DIR, file), "utf-8");
	const probes = probesFor(raw);
	if (probes.length === 0) {
		console.warn(`[assert-no-plaintext] ${file} 取不到探针（正文太短？），跳过`);
		continue;
	}
	probeCount += probes.length;

	for (const df of distFiles) {
		const content = fs.readFileSync(df, "utf-8");
		for (const probe of probes) {
			if (content.includes(probe)) {
				hits.push({ draft: file, dist: path.relative(ROOT, df), probe });
			}
		}
	}
}

if (hits.length > 0) {
	console.error("\n[assert-no-plaintext] 明文泄漏！构建产物里搜到了草稿正文：\n");
	for (const h of hits) {
		console.error(`  ${h.dist}`);
		console.error(`    来自 ${h.draft}`);
		console.error(`    命中 "${h.probe}"`);
	}
	console.error("\n不要部署这份产物。");
	process.exit(1);
}

console.log(
	`[assert-no-plaintext] 通过。${probeCount} 条探针 × ${distFiles.length} 个产物文件，无命中。`,
);
