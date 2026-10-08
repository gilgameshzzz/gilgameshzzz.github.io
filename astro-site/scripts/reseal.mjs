#!/usr/bin/env node
/**
 * `pnpm reseal` —— 强制重新加密所有文章，忽略指纹缓存。
 *
 * 平时 `pnpm seal` 只在内容或密码变了才重新加密；换新密码、或怀疑
 * 指纹缓存不对时用这个。
 *
 * 存在的理由只是跨平台设环境变量:`SEAL_FORCE=1 pnpm seal` 在 PowerShell
 * 下不成立，而为这一行加 cross-env 依赖不值得。
 */
import { spawnSync } from "node:child_process";

const r = spawnSync("pnpm", ["seal"], {
	stdio: "inherit",
	shell: true,
	env: { ...process.env, SEAL_FORCE: "1" },
});

process.exit(r.status ?? 1);
