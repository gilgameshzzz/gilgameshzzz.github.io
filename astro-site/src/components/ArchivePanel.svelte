<script lang="ts">
import { onMount } from "svelte";

import I18nKey from "../i18n/i18nKey";
import { i18n } from "../i18n/translation";
import { getPostUrlBySlug } from "../utils/url-utils";

export let tags: string[];
export let categories: string[];
export let sortedPosts: Post[] = [];

const params = new URLSearchParams(window.location.search);
tags = params.has("tag") ? params.getAll("tag") : [];
categories = params.has("category") ? params.getAll("category") : [];
const uncategorized = params.get("uncategorized");

interface Post {
	slug: string;
	data: {
		title: string;
		description?: string;
		tags: string[];
		category?: string;
		published: Date;
	};
}

interface Group {
	year: number;
	posts: Post[];
}

let groups: Group[] = [];
// 筛选后的总数与年份跨度,用于顶部概览
let total = 0;
let span = "";

function formatDate(date: Date) {
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	return `${month}-${day}`;
}

function formatTag(tagList: string[]) {
	return tagList.map((t) => `#${t}`).join(" ");
}

onMount(async () => {
	let filteredPosts: Post[] = sortedPosts;

	if (tags.length > 0) {
		filteredPosts = filteredPosts.filter(
			(post) =>
				Array.isArray(post.data.tags) &&
				post.data.tags.some((tag) => tags.includes(tag)),
		);
	}

	if (categories.length > 0) {
		filteredPosts = filteredPosts.filter(
			(post) => post.data.category && categories.includes(post.data.category),
		);
	}

	if (uncategorized) {
		filteredPosts = filteredPosts.filter((post) => !post.data.category);
	}

	const grouped = filteredPosts.reduce(
		(acc, post) => {
			const year = post.data.published.getFullYear();
			if (!acc[year]) {
				acc[year] = [];
			}
			acc[year].push(post);
			return acc;
		},
		{} as Record<number, Post[]>,
	);

	const groupedPostsArray = Object.keys(grouped).map((yearStr) => ({
		year: Number.parseInt(yearStr, 10),
		posts: grouped[Number.parseInt(yearStr, 10)],
	}));

	groupedPostsArray.sort((a, b) => b.year - a.year);

	groups = groupedPostsArray;
	total = filteredPosts.length;
	span =
		groups.length === 0
			? ""
			: groups.length === 1
				? `${groups[0].year}`
				: `${groups[groups.length - 1].year} — ${groups[0].year}`;
});
</script>

<!-- 概览:筛选后的篇数与年份跨度 -->
{#if total > 0}
    <div class="card-base px-8 py-5 mb-4 text-sm text-50">
        共 {total} 篇 · {span}
    </div>
{/if}

<div class="card-base px-5 md:px-8 py-6 md:py-8">
    {#each groups as group}
        <section class="mb-10 last:mb-0">
            <!-- 年份标记 -->
            <div class="flex items-center gap-4 mb-5">
                <div class="w-14 md:w-20 shrink-0 text-right text-2xl md:text-3xl font-bold
                            text-[var(--primary)] tabular-nums">
                    {group.year}
                </div>
                <div class="w-3 h-3 shrink-0 rounded-full bg-[var(--primary)]
                            ring-4 ring-[var(--btn-regular-bg)]"></div>
                <div class="text-sm text-50">
                    {group.posts.length} {i18n(group.posts.length === 1 ? I18nKey.postCount : I18nKey.postsCount)}
                </div>
            </div>

            <!-- 该年的条目,共用一条纵向轨道 -->
            <div class="flex">
                <div class="w-14 md:w-20 shrink-0"></div>
                <div class="min-w-0 flex-1 ml-[0.3125rem] border-l-[2px] border-[var(--line-divider)]
                            pl-6 md:pl-8 flex flex-col gap-5">
                    {#each group.posts as post}
                        <a
                            href={getPostUrlBySlug(post.slug)}
                            aria-label={post.data.title}
                            class="group relative block -my-1 py-1 pr-2 rounded-xl transition
                                   hover:bg-[var(--btn-plain-bg-hover)]"
                        >
                            <!-- 轨道上的节点 -->
                            <div class="absolute -left-[calc(1.5rem_+_5px)] md:-left-[calc(2rem_+_5px)] top-[0.6rem]
                                        w-2 h-2 rounded-full bg-[var(--line-divider)] transition
                                        group-hover:bg-[var(--primary)] group-hover:scale-150"></div>

                            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <time class="text-sm text-50 tabular-nums shrink-0"
                                      datetime={post.data.published.toISOString()}>
                                    {formatDate(post.data.published)}
                                </time>
                                <span class="text-lg font-bold text-90 transition
                                             group-hover:text-[var(--primary)]">
                                    {post.data.title}
                                </span>
                            </div>

                            {#if post.data.description}
                                <div class="text-sm text-50 mt-1 line-clamp-2">
                                    {post.data.description}
                                </div>
                            {/if}

                            {#if post.data.tags.length > 0}
                                <div class="text-xs text-30 mt-1.5">
                                    {formatTag(post.data.tags)}
                                </div>
                            {/if}
                        </a>
                    {/each}
                </div>
            </div>
        </section>
    {/each}
</div>
