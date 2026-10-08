import type { AstroComponentFactory } from "astro/runtime/server/index.js";

/**
 * 明文草稿加载器。
 *
 * 草稿放在 astro-site/private/drafts/<slug>.md,整个 private/ 被 gitignore ——
 * 这是明文在工作区里唯一的副本,永远不进仓库。
 *
 * 为什么用 import.meta.glob 而不是 content collection:
 * 1. 本项目处于 Astro 5 的隐式 legacy collections 模式(entry.slug / entry.render()
 *    能用全靠这个)。新增一个带 loader 的 collection 有把整个 config 推向新 API 的风险。
 * 2. glob 匹配不到文件时返回 {},CI 上 private/ 根本不存在也不会报错 —— 正是我们要的。
 * 3. 走的是同一条 Astro markdown 管线,Expressive Code / KaTeX / 表格的渲染效果
 *    与正式文章完全一致(已由 spike 验证)。
 */

const drafts = import.meta.glob<{
	Content: AstroComponentFactory;
	frontmatter: Record<string, unknown>;
}>("../../private/drafts/*.md");

export interface LoadedDraft {
	Content: AstroComponentFactory;
	words: number;
	minutes: number;
}

/** 找不到草稿返回 null(CI 上总是 null),调用方据此回落到已提交的密文 */
export async function loadDraft(slug: string): Promise<LoadedDraft | null> {
	const file = `${slug.replace(/\//g, "__")}.md`;
	const key = Object.keys(drafts).find((k) => k.endsWith(`/${file}`));
	if (!key) return null;

	const mod = await drafts[key]();
	const fm = mod.frontmatter ?? {};
	return {
		Content: mod.Content,
		// 草稿走同一条 remark 管线,字数插件也跑过了,直接取
		words: typeof fm.words === "number" ? fm.words : 0,
		minutes: typeof fm.minutes === "number" ? fm.minutes : 0,
	};
}
