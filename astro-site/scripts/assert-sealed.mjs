#!/usr/bin/env node
/**
 * 封装状态断言。CI 和 pre-commit 共用,**CI 里的这一道才是真防线**
 * (pre-commit hook 不随仓库分发,换台机器就没了)。
 *
 * 三条:
 * 1. 存根里 protected: true 但正文非空 → 明文要进仓库了
 * 2. protected: true 但 encrypted/<slug>.json 缺失 → CI 构建必然失败
 * 3. private/ 下有文件被 git track → gitignore 对已 track 的文件无效,这是个真实陷阱
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_DIR = path.join(ROOT, "src", "content", "posts");
const ENCRYPTED_DIR = path.join(ROOT, "encrypted");

const errors = [];

function walkMd(dir, base = "") {
	const out = [];
	if (!fs.existsSync(dir)) return out;
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const rel = base ? `${base}/${e.name}` : e.name;
		if (e.isDirectory()) out.push(...walkMd(path.join(dir, e.name), rel));
		else if (e.name.endsWith(".md")) out.push(rel);
	}
	return out;
}

for (const rel of walkMd(POSTS_DIR)) {
	const raw = fs.readFileSync(path.join(POSTS_DIR, rel), "utf-8");
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!m) continue;
	const [, fm, body] = m;
	if (!/^protected\s*:\s*true\s*$/m.test(fm)) continue;

	const slug = rel.replace(/\.md$/, "");

	// 1. 正文必须是空的(只允许注释和空白)
	const meaningful = body
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/\s+/g, "");
	if (meaningful.length > 0) {
		errors.push(
			`${rel}: protected: true 但正文非空（${meaningful.length} 个非空白字符）。\n` +
				"    明文正文不能进仓库。把正文移到 private/drafts/ 后跑 pnpm seal。",
		);
	}

	// 2. 密文载荷必须存在
	const payload = path.join(ENCRYPTED_DIR, `${slug.replace(/\//g, "__")}.json`);
	if (!fs.existsSync(payload)) {
		errors.push(
			`${rel}: protected: true 但缺少密文载荷 ${path.relative(ROOT, payload)}。\n` +
				"    跑 pnpm seal 生成，否则 CI 构建会失败。",
		);
	}
}

// 3. private/ 下不能有被 track 的文件
try {
	const tracked = execFileSync(
		"git",
		["ls-files", "--", "astro-site/private", "astro-site/secrets/post-passwords.json"],
		{ cwd: path.resolve(ROOT, ".."), encoding: "utf-8" },
	).trim();
	if (tracked) {
		errors.push(
			`以下文件被 git track 了，gitignore 对已 track 的文件无效：\n` +
				`${tracked
					.split("\n")
					.map((l) => `    ${l}`)
					.join("\n")}\n` +
				"    用 git rm --cached <file> 取消跟踪。",
		);
	}
} catch {
	// 不在 git 仓库里(比如 CI 的某些场景)就跳过这一条
}

if (errors.length > 0) {
	console.error("\n[assert-sealed] 失败：\n");
	for (const e of errors) console.error(`  ${e}\n`);
	process.exit(1);
}

console.log("[assert-sealed] 通过。");
