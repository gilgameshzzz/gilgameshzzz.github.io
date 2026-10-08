import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { EncryptedPayload } from "./crypto-utils";

/**
 * 密文载荷的磁盘存储。
 *
 * 为什么用 node fs 而不是 import / content collection:
 * 写进 src/ 会被 Vite 监听,写进 src/content/ 还会被 collection watcher 盯上,
 * dev 模式下「构建期写盘 → 触发 HMR → 再次构建 → 再写盘」必然死循环。
 * 放在 src/ 外且不被任何模块 import,Vite 完全感知不到。
 *
 * 职责边界:
 * - encrypted/<slug>.json  【提交进仓库】密文载荷,CI 只读这个
 * - private/.seal-state.json 【gitignore】指纹缓存,用来判断「内容没变就别重新加密」
 *
 * 指纹只存在 gitignore 的那份里,不写进提交的 JSON ——
 * 提交的文件里多一个 sha256(明文+密码),等于白送攻击者一个离线校验口。
 */

const ROOT = process.cwd();
const ENCRYPTED_DIR = path.join(ROOT, "encrypted");
const SEAL_STATE_FILE = path.join(ROOT, "private", ".seal-state.json");

/** 提交进仓库的载荷。在 EncryptedPayload 之外带上字数/阅读时长,
    因为存根正文是空的,列表页和文章页都算不出来。 */
export interface StoredPayload extends EncryptedPayload {
	words: number;
	minutes: number;
}

function payloadPath(slug: string): string {
	// slug 可能含 "/"(嵌套目录),转成扁平文件名,避免建子目录
	return path.join(ENCRYPTED_DIR, `${slug.replace(/\//g, "__")}.json`);
}

export function readPayload(slug: string): StoredPayload | null {
	const file = payloadPath(slug);
	if (!fs.existsSync(file)) return null;
	try {
		return JSON.parse(fs.readFileSync(file, "utf-8")) as StoredPayload;
	} catch (e) {
		throw new Error(
			`密文载荷 ${file} 解析失败: ${e instanceof Error ? e.message : String(e)}`,
		);
	}
}

export function writePayload(slug: string, payload: StoredPayload): void {
	fs.mkdirSync(ENCRYPTED_DIR, { recursive: true });
	// 2 空格 + 末尾换行,让 diff 稳定、可读
	fs.writeFileSync(
		payloadPath(slug),
		`${JSON.stringify(payload, null, 2)}\n`,
		"utf-8",
	);
}

/** 内容指纹。密码也参与计算,这样「换了密码但正文没动」也会触发重新加密。 */
export function fingerprint(html: string, password: string): string {
	return crypto
		.createHash("sha256")
		.update(html)
		.update("\0")
		.update(password)
		.digest("hex");
}

type SealState = Record<string, string>;

function readSealState(): SealState {
	if (!fs.existsSync(SEAL_STATE_FILE)) return {};
	try {
		return JSON.parse(fs.readFileSync(SEAL_STATE_FILE, "utf-8")) as SealState;
	} catch {
		// 缓存坏了不算错误,最多是多加密一次
		return {};
	}
}

export function getSealedFingerprint(slug: string): string | null {
	return readSealState()[slug] ?? null;
}

export function setSealedFingerprint(slug: string, fp: string): void {
	const state = readSealState();
	state[slug] = fp;
	fs.mkdirSync(path.dirname(SEAL_STATE_FILE), { recursive: true });
	fs.writeFileSync(
		SEAL_STATE_FILE,
		`${JSON.stringify(state, null, 2)}\n`,
		"utf-8",
	);
}
