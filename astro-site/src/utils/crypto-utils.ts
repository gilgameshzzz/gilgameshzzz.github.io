import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * 构建期加密工具。
 *
 * 安全边界(务必了解):
 * - 密文和 KDF 参数都会公开发布,攻击者可以离线暴力破解。
 *   唯一的防线是密码强度和 PBKDF2 的迭代次数。短密码/常见词几分钟就能跑出来。
 * - 因此这适合「不想公开、但泄露了也不致命」的内容,
 *   不适合公司资料、凭据这类真正敏感的东西。
 * - 密码本身绝不进仓库,放在被 gitignore 的 secrets/post-passwords.json。
 */

const PBKDF2_ITERATIONS = 310000; // 与 OWASP 对 PBKDF2-SHA256 的建议一致
const KEY_LENGTH = 32; // AES-256
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // GCM 推荐 96 位

const SECRET_FILE = path.join(process.cwd(), "secrets", "post-passwords.json");

let cache: Record<string, string> | null = null;

/** 读取 slug -> 密码 的映射;文件不存在时返回空表 */
function loadPasswords(): Record<string, string> {
	if (cache) return cache;

	if (!fs.existsSync(SECRET_FILE)) {
		cache = {};
		return cache;
	}

	try {
		const raw = fs.readFileSync(SECRET_FILE, "utf-8");
		const parsed = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			throw new Error("post-passwords.json 的顶层必须是对象");
		}
		cache = parsed as Record<string, string>;
	} catch (e) {
		throw new Error(
			`无法解析 ${SECRET_FILE}: ${e instanceof Error ? e.message : String(e)}`,
		);
	}

	return cache;
}

export function getPasswordForSlug(slug: string): string | null {
	const map = loadPasswords();
	const pwd = map[slug];
	return typeof pwd === "string" && pwd.length > 0 ? pwd : null;
}

export interface EncryptedPayload {
	salt: string; // base64
	iv: string; // base64
	data: string; // base64,GCM 密文 + 认证标签
	iterations: number;
	hint: string;
}

/** 用 AES-256-GCM 加密;GCM 自带完整性校验,密码错会解密失败而不是产出乱码 */
export function encryptContent(
	plaintext: string,
	password: string,
	hint = "",
): EncryptedPayload {
	const salt = crypto.randomBytes(SALT_LENGTH);
	const iv = crypto.randomBytes(IV_LENGTH);

	const key = crypto.pbkdf2Sync(
		password,
		salt,
		PBKDF2_ITERATIONS,
		KEY_LENGTH,
		"sha256",
	);

	const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf-8"),
		cipher.final(),
	]);
	// WebCrypto 的 decrypt 期望标签拼在密文尾部
	const payload = Buffer.concat([encrypted, cipher.getAuthTag()]);

	return {
		salt: salt.toString("base64"),
		iv: iv.toString("base64"),
		data: payload.toString("base64"),
		iterations: PBKDF2_ITERATIONS,
		hint,
	};
}
