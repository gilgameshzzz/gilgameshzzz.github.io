---
title: "在 Astro 博客里嵌入可交互的 HTML/JS 演示"
published: 2026-09-18
description: "把独立 HTML 放进 public/，再用 iframe 嵌入文章正文——绕开 swup 客户端路由导致的脚本失效，同时隔离样式与报错。附一个数据可视化 / 3D / 动画 / 力导向图的四合一 demo。"
tags: ["Astro", "前端", "Canvas", "数据可视化"]
category: "前端"
draft: false
---

## 先说结论

Astro 的 Markdown 会原样输出行内 HTML，所以在 `.md` 里直接写 `<script>` 确实能跑——**但只在首次加载时跑一次**。

这个主题启用了 `@swup/astro`，站内跳转是客户端路由：

```js
// astro.config.mjs
swup({
  containers: ["main", "#toc"],
  cache: true,
  preload: true,
})
```

swup 只把新页面的 `main` 容器内容换进 DOM。通过 `innerHTML` 插入的 `<script>` 标签**不会被浏览器执行**。结果就是：直接打开文章链接，动画正常；从首页点进来，白板一块。这类 bug 只在特定入口复现，排查起来很费时间。

## 用 iframe 隔离

把演示写成独立 HTML 放进 `public/`，该目录的文件会被原样拷贝到 `dist/`，不经过 Astro 的构建管线：

```
astro-site/public/demos/showcase.html   →  /demos/showcase.html
```

正文里嵌入：

```html
<iframe src="/demos/showcase.html"
        style="width:100%;height:560px;border:0;border-radius:.75rem"
        loading="lazy" title="网页能力演示"></iframe>
```

这样做有四个好处：

- **不受 swup 影响**——iframe 是独立文档，`src` 变化时浏览器完整加载一遍
- **样式互不污染**——主题的 `markdown.css` 不会波及 demo，反之亦然
- **报错被隔离**——demo 里的 JS 异常不会拖垮整个页面
- **能单独打开**——直接访问 `/demos/showcase.html` 就是一个完整页面，方便调试

## 效果

下面这个 demo 零外部依赖，不加载任何 CDN，四个标签页分别是 SVG 折线图、手写 3D 渲染管线、柏林噪声流场粒子、力导向图：

<iframe src="/demos/showcase.html"
        style="width:100%;height:580px;border:1px solid var(--line-divider);border-radius:.75rem"
        loading="lazy" title="网页能力演示：数据可视化 / 3D / 动画 / 交互"></iframe>

几个实现上的点：

**3D 那一栏没用 three.js**，是手写的渲染管线。参数化生成圆环面的四边形网格，绕 Y 轴和 X 轴做旋转矩阵变换，按面片重心的 z 值排序后由远及近绘制（画家算法），着色用叉积求面法线再算 Lambert 漫反射。透视除法直接写在投影函数里：

```js
const proj = p => [
  cx + p[0] / (3.6 - p[2]) * f * 2.2,
  cy + p[1] / (3.6 - p[2]) * f * 2.2,
];
```

相邻面片之间会有亚像素接缝，解决办法是用填充色本身再描一遍 0.5px 的边。

**粒子的拖尾不靠记录历史轨迹**，而是每帧用 `globalAlpha = 0.07` 的背景色覆盖一层，旧像素自然衰减。2000 个粒子只需存当前坐标，内存是常数。

**只有当前标签页在跑 rAF**，切换时其余面板完全停止计算——四个 canvas 同时跑会明显掉帧。

## 主题同步

iframe 里是独立文档，读不到外层的 `data-theme`。留了两个口子，父页面二选一：

```js
// 方式一：URL 参数
<iframe src="/demos/showcase.html?theme=dark">

// 方式二：postMessage
iframe.contentWindow.postMessage({ type: 'theme', value: 'dark' }, '*');
```

demo 内部默认跟随系统 `prefers-color-scheme`，右上角也有手动切换按钮。

## 什么时候不该用 iframe

如果演示需要读取文章上下文、或者要和页面其他部分联动，iframe 的隔离就成了阻碍。这时候用 Svelte 组件更合适——主题已经装了 `@astrojs/svelte`：

```astro
---
import Demo from '../components/demos/Demo.svelte';
---
<Demo client:visible />
```

hydration 由 Astro 托管，swup 切换后会正确重新挂载，也能直接吃到主题的 CSS 变量。代价是**不能写在 `.md` 里**——要在 Markdown 中用组件，得装 `@astrojs/mdx` 并把文章改成 `.mdx`。
