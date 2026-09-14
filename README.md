# gilgameshzzz.github.io

个人博客。Astro + [Fuwari](https://github.com/saicaca/fuwari) 主题，部署在 GitHub Pages。

线上地址：https://gilgameshzzz.github.io/

---

## 目录结构

```
blog/
├── astro-site/              ← 当前使用的站点，所有开发都在这里
│   ├── src/
│   │   ├── content/posts/   ← 文章 Markdown，一篇一个 .md
│   │   ├── components/      ← 组件
│   │   ├── layouts/         ← 页面骨架
│   │   ├── config.ts        ← 站点标题、导航、头像等
│   │   └── utils/
│   ├── public/banners/      ← 轮播背景的视频/GIF（放这里才不会被压成静态图）
│   ├── src/assets/images/banners/  ← 轮播背景的静态图
│   └── secrets/             ← 加密文章的密码（已 gitignore）
├── hexo_blog/               ← 旧的 Hexo 站点，只作存档，不再维护
└── .github/workflows/       ← 自动部署
```

**注意**：`hexo_blog/` 是历史遗留，改它不会影响线上任何内容。

---

## 一、在新机器上跑起来

### 需要装的

- **Node.js 20 或更高** —— https://nodejs.org/
- **pnpm** —— 装完 Node 后执行 `npm install -g pnpm`

> 这个项目锁定了 pnpm，用 npm 或 yarn 安装会被 `preinstall` 脚本拒绝。

### 三条命令

```bash
git clone https://github.com/gilgameshzzz/gilgameshzzz.github.io.git blog
cd blog/astro-site
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

打开 http://localhost:4321/ ，改文件会自动刷新。

### 其他常用命令

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 本地开发，热更新 |
| `pnpm build` | 构建到 `dist/`，**发布前务必跑一次** |
| `pnpm preview` | 预览构建产物（和线上最接近） |
| `pnpm lint` | 自动格式化 + 修复代码风格 |
| `pnpm new-post <名字>` | 生成一篇新文章的骨架 |

---

## 二、写文章

在 `astro-site/src/content/posts/` 下新建一个 `.md` 文件，文件名就是网址里的 slug。

```markdown
---
title: 文章标题
published: 2026-09-15
description: 列表页显示的一句话摘要
tags: ["Java", "工程实践"]
category: "工程实践"
draft: false
---

正文从这里开始。

<!-- more -->

上面这行以上的内容会作为首页摘要。
```

### 字段说明

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | 是 | 标题 |
| `published` | 是 | 发布日期，`YYYY-MM-DD` |
| `description` | 否 | 列表页摘要。**不填会自动截取正文开头** |
| `tags` | 否 | 标签数组，会进侧边栏 3D 标签云 |
| `category` | 否 | 分类，一篇只能有一个 |
| `draft` | 否 | `true` 则只在本地可见，不会发布 |
| `image` | 否 | 封面图 |
| `protected` | 否 | 加密文章，见下一节 |
| `passwordHint` | 否 | 密码提示，**会公开显示** |

### 能用的 Markdown 扩展

````markdown
> [!NOTE]
> 提示框，另有 TIP / IMPORTANT / WARNING / CAUTION

::github{repo="gilgameshzzz/某仓库"}

$E = mc^2$  行内公式，$$...$$ 是独立公式

```java {2,4-6}
// 花括号里的行号会被高亮
```
````

### 改站点配置

`astro-site/src/config.ts` —— 标题、副标题、导航栏、头像、个人简介、主题色都在这。

---

## 三、加密文章

### 先了解这是什么级别的保护

GitHub Pages 是纯静态站，**没有服务端鉴权**。这里的做法是：构建时用密码把正文加密成密文，页面里只有密文，读者输密码后在浏览器里解密。

**它能挡住**：随手点进来的人、搜索引擎、爬虫、看网页源码的人。

**它挡不住**：拿到页面后离线暴力破解。密文和参数都是公开的，唯一的防线是**密码强度**。

所以：

- ✅ 适合私人笔记、未完成的草稿、只想给特定朋友看的东西
- ❌ **不要**放公司资料、密钥、凭据、真正的隐私信息

### 怎么设置（每篇可以不同密码）

**第一步**，文章 front-matter 加两行。注意**密码不写在这里**，因为这个文件会进公开仓库：

```yaml
---
title: 我的私密笔记
published: 2026-09-15
protected: true
passwordHint: 我们第一次见面的城市    # 可选，会公开显示
---
```

**第二步**，在 `astro-site/secrets/post-passwords.json` 里按 slug 填密码。这个文件已被 gitignore，不会进仓库：

```json
{
  "my-private-note": "correct-horse-battery-staple",
  "another-post": "完全不同的另一个密码"
}
```

**slug 就是 md 文件名去掉 `.md`**。比如 `src/content/posts/my-private-note.md` 的 slug 是 `my-private-note`。

第一次用的话，可以直接复制模板：

```bash
cd astro-site
cp secrets/post-passwords.example.json secrets/post-passwords.json
```

### 几个要知道的

**构建会拦你。** 如果某篇标了 `protected: true` 但 json 里查不到密码，`pnpm build` 会直接报错失败，而不是把正文明文发出去。这是故意的。

**这个 json 一定要备份。** 它不在 git 里，机器坏了或者换电脑，没有它就无法重新构建那些文章。存到密码管理器或私有仓库。

**换密码**：改 json 重新构建即可，旧密文会被覆盖。

**读者体验**：输一次密码后，同一个浏览器标签页内刷新不用重输（存在 sessionStorage），关掉标签页就失效。

---

## 四、部署到 GitHub Pages

### 一次性设置（只做一次）

**1. 打开 Pages 的 Actions 模式**

仓库页面 → **Settings** → **Pages** → **Build and deployment** → Source 选 **GitHub Actions**。

> 这一步很关键。如果还是 "Deploy from a branch"，工作流跑完了页面也不会更新。

**2. 如果有加密文章，配一个 Secret**

仓库页面 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

- Name：`POST_PASSWORDS`
- Secret：把本地 `secrets/post-passwords.json` 的**全部内容**粘进去

```json
{
  "my-private-note": "你的密码"
}
```

没有加密文章的话，这步可以跳过，工作流会自动跳过这一环。

### 日常发布

```bash
git add .
git commit -m "新增文章：xxx"
git push origin hexo
```

> 当前工作分支是 `hexo`（仓库里还有一个历史的 `master`）。工作流对 `hexo` / `master` / `main` 三个分支都会触发，所以推到哪个都能部署。如果以后想统一成 `main`，重命名分支即可，工作流不用改。

推上去之后 GitHub Actions 自动构建部署，1–3 分钟后线上生效。进度在仓库的 **Actions** 标签页看。

### 发布前的检查

```bash
cd astro-site
pnpm build     # 构建必须先过
pnpm preview   # 再本地看一眼
```

**养成先 build 的习惯。** 本地 `pnpm dev` 能跑不代表构建能过（加密文章缺密码、图片路径错这类问题只在 build 时暴露）。

---

## 五、常见问题

**`pnpm install` 报错说只允许 pnpm**
用了 npm 或 yarn。删掉 `node_modules` 和 `package-lock.json`，改用 pnpm。

**构建报错「标记了 protected: true，但没有对应密码」**
`secrets/post-passwords.json` 里缺这篇的 slug，或者 slug 拼错了。slug = md 文件名去掉 `.md`。

**推上去了但网站没更新**
1. 看 Actions 标签页，构建是不是失败了
2. 确认 Settings → Pages 的 Source 是 **GitHub Actions** 而不是分支
3. 浏览器强制刷新（Ctrl+Shift+R）

**加密文章在线上显示不出来 / 一直说密码错**
GitHub Secret 里的 `POST_PASSWORDS` 和本地 json 不一致。更新 Secret 后要重新触发一次部署（Actions → 选中工作流 → Run workflow）。

**本地改了图片但页面没变**
Astro 会缓存图片处理结果。删掉 `astro-site/.astro/` 和 `node_modules/.vite/` 再试。

**端口 4321 被占用**
`pnpm dev --port 4322`

---

## 六、改代码的一些提示

**背景轮播**：静态图放 `src/assets/images/banners/`，视频和 GIF 必须放 `public/banners/`（Astro 的图片管线会把 GIF 压成静态图）。按文件名排序轮播。

**侧边栏 3D 标签云**：`src/components/widget/TagCloud3D.astro`。旧的平铺版本还留在 `Tags.astro`，想换回去改 `SideBar.astro` 的 import 即可。

**鼠标特效**：`src/components/misc/MouseFx.astro`。不想要就把 `Layout.astro` 里的 `<MouseFx>` 删掉。

**时间线页**：路由还是 `/archive/`，只是显示名改成了「时间线」（在 `src/i18n/languages/zh_CN.ts`）。**别改路由**，标签和分类的筛选链接都指向它。

**页面切换用了 swup**，只替换 `main` 和 `#toc` 两个容器。写在这两个容器外面的组件，初始化逻辑要监听 `astro:after-swap` 事件，否则跳转一次就失效。这是个容易踩的坑。
