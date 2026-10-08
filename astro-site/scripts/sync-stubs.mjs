#!/usr/bin/env node
/**
 * 从 private/drafts/<slug>.md 的 front-matter 生成 src/content/posts/<slug>.md 存根。
 *
 * 存根只有 front-matter,正文固定一行注释 —— 正文永远不进仓库。
 *
 * 为什么是独立脚本,而不是构建期自动做:
 * 1. 构建期往 src/content/ 写文件会被 collection watcher 盯上,dev 下 HMR 死循环。
 * 2. getCollection 在构建一开始就把条目全读完了,当次构建根本用不上新写的值。
 * 所以:先 sync-stubs,再 astro build。`pnpm seal` 就是这个顺序。
 *
 * front-matter 采用白名单,避免草稿里的私人字段(比如随手记的备注)漏进仓库。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRAFTS_DIR = path.join(ROOT, "private", "drafts");
const POSTS_DIR = path.join(ROOT, "src", "content", "posts");

/** 允许进入公开存根的字段。不在这个表里的一律丢弃。 */
const ALLOWED = [
	"title",
	"published",
	"updated",
	"draft",
	"description",
	"image",
	"tags",
	"category",
	"lang",
	"protected",
	"passwordHint",
];

const STUB_BODY =
	"<!-- 正文已加密，密文在 astro-site/encrypted/ 下，明文草稿在本地 private/drafts/ -->\n";

/** 极简 front-matter 切分:只取首尾两行 --- 之间的内容,不解析 YAML。
    逐行白名单过滤,保留原始写法(缩进的 list item 跟随上一个键)。 */
function splitFrontmatter(raw) {
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!m) return null;
	return m[1];
}

function filterFrontmatter(fm, file) {
	const out = [];
	let keeping = false;
	for (const line of fm.split(/\r?\n/)) {
		// 续行(缩进或 "- " 开头)跟随上一个键的去留
		if (/^\s+\S/.test(line) || /^\s*-\s/.test(line)) {
			if (keeping) out.push(line);
			continue;
		}
		const key = line.match(/^([A-Za-z_][\w-]*)\s*:/);
		if (!key) {
			if (line.trim() === "" && keeping) out.push(line);
			continue;
		}
		keeping = ALLOWED.includes(key[1]);
		if (keeping) out.push(line);
	}

	const text = out.join("\n");
	if (!/^protected\s*:\s*true\s*$/m.test(text)) {
		throw new Error(
			`${file} 的 front-matter 里没有 protected: true。\n` +
				"sync-stubs 只负责加密文章;普通文章请直接写在 src/content/posts/ 下。",
		);
	}
	if (!/^title\s*:/m.test(text)) {
		throw new Error(`${file} 的 front-matter 缺少 title`);
	}
	return text;
}

if (!fs.existsSync(DRAFTS_DIR)) {
	console.log(`[sync-stubs] ${DRAFTS_DIR} 不存在，跳过。`);
	process.exit(0);
}

const files = fs.readdirSync(DRAFTS_DIR).filter((f) => f.endsWith(".md"));
if (files.length === 0) {
	console.log("[sync-stubs] 没有草稿，跳过。");
	process.exit(0);
}

let changed = 0;
for (const file of files) {
	const raw = fs.readFileSync(path.join(DRAFTS_DIR, file), "utf-8");
	const fm = splitFrontmatter(raw);
	if (fm === null) {
		throw new Error(`${file} 没有 front-matter（文件必须以 --- 开头）`);
	}

	const stub = `---\n${filterFrontmatter(fm, file)}\n---\n\n${STUB_BODY}`;
	const target = path.join(POSTS_DIR, file.replace(/__/g, path.sep));

	const before = fs.existsSync(target) ? fs.readFileSync(target, "utf-8") : null;
	if (before === stub) {
		console.log(`[sync-stubs] 未变化  ${file}`);
		continue;
	}

	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, stub, "utf-8");
	changed++;
	console.log(`[sync-stubs] ${before === null ? "新建" : "更新"}  ${file}`);
}

console.log(`[sync-stubs] 完成，${files.length} 篇草稿，${changed} 个存根有改动。`);
