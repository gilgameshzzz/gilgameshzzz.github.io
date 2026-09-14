---
title: "一次 GitHub Pages 部署的四连翻车复盘"
published: 2026-09-15
description: "从 Hexo 迁到 Astro 后首次部署，连续踩了四个坑：不存在的分支、secrets 上下文误用、Node 20 弃用警告、以及最坑的 .gitignore 模式未锚定导致整站文章没进仓库。"
tags: ["GitHub Actions", "CI/CD", "Git", "踩坑"]
category: "工程实践"
protected: true
passwordHint: "本文的密码就是 deploy-postmortem（这是一篇用来验证加密功能的测试文章）"
draft: false
---

博客从 Hexo 迁到 Astro 之后第一次配自动部署，连着翻车四次才绿。四个错因完全不同，但有个共同点：**每一个都是本地测不出来的**。

<!-- more -->

## 一、工作流指向了一个不存在的分支

写 workflow 时顺手写了业界默认值：

```yaml
on:
  push:
    branches: [main]
```

但 `git branch -a` 一看，这个仓库只有 `hexo`（当前）和 `master`，`origin/HEAD` 指向 `master`。**根本没有 `main` 分支。**

推上去之后 Actions 页面一片空白 —— 不是失败，是压根没触发。这种「没有任何反馈」的失败最难查，因为没有日志可看。

**改法**：

```yaml
branches: [hexo, master, main]
```

三个都收，推哪个分支都能部署，以后想统一成 `main` 也不用回来改。

**教训**：写 CI 之前先 `git branch -a`。`main` 是约定不是事实，老仓库大多还是 `master`。

## 二、`secrets` 不能用在 step 级的 `if` 里

```
Invalid workflow file: (Line: 40, Col: 13):
Unrecognized named-value: 'secrets'
```

出错的是这段 —— 想表达「配了密码才还原密码文件，没配就跳过」：

```yaml
- name: Restore encrypted post passwords
  if: ${{ secrets.POST_PASSWORDS != '' }}   # ← 这里不行
```

GitHub Actions 的**上下文有作用域**。`secrets` 只在 `env:`、`with:`、`run:` 这些地方可用，**step 级的 `if:` 表达式里不可用**。设计如此，为了减少密文泄进条件求值日志的面。

**改法**：绕一层 env。

```yaml
jobs:
  build:
    env:
      POST_PASSWORDS: ${{ secrets.POST_PASSWORDS }}
    steps:
      - name: Restore encrypted post passwords
        if: env.POST_PASSWORDS != ''
        run: |
          mkdir -p secrets
          printf '%s' "$POST_PASSWORDS" > secrets/post-passwords.json
```

job 级 `env` 可以引用 `secrets`，`if` 可以引用 `env`，串起来就通了。

注意 `if:` 里引用 env **不要**加 `${{ }}` —— 加了在某些位置会被当成字符串。

## 三、Node 20 弃用警告（这条其实不是错误）

```
Node.js 20 is deprecated. The following actions target Node.js 20
but are being forced to run on Node.js 24:
actions/checkout@v4, actions/setup-node@v4, pnpm/action-setup@v4
```

**这是黄色警告，不是红叉。** 构建照常跑完。GitHub 在淘汰 Node 20 运行时，这几个 action 被自动搬到 Node 24 上执行了。

值得单独记一笔，是因为它很容易被误当成失败原因 —— 日志里一堆黄字，注意力就被吸过去了，而真正的红叉在下面几十行。**看 CI 日志先找红叉，别被黄字带偏。**

顺手升掉免得以后真失效：

```yaml
- uses: actions/checkout@v5
- uses: actions/setup-node@v5
  with:
    node-version: 22
    cache: pnpm
    cache-dependency-path: astro-site/pnpm-lock.yaml
```

`pnpm/action-setup@v4` 不用动，它的 v4 本身已经是 Node 24 运行时了。

有个坑要留意：**`setup-node` v5 改了默认行为** —— 不写 `cache` 时会自动检测包管理器并开启缓存。显式写了 `cache: pnpm` 就不受影响。

## 四、最坑的一个：`.gitignore` 模式没锚定

```
[ERROR] Image file not found: src/assets/images/avatar.jpg
```

本地文件明明在。`git ls-files` 一查 —— **整个 `src/assets/images/` 一个文件都没进仓库**。

罪魁是我写的根 `.gitignore`：

```gitignore
posts/          # ← 想忽略根目录的迁移临时产物
assets/         # ← 同上
```

**gitignore 里不带斜杠前缀的模式匹配任意层级。** `assets/` 不只匹配 `./assets/`，还匹配 `astro-site/src/assets/`、`任意/深度/assets/`。

于是被误伤的有：

- `astro-site/src/assets/images/` —— 头像和 8 张 banner
- `astro-site/src/content/posts/` —— **全部 28 篇文章**
- `astro-site/src/pages/posts/[...slug].astro` —— 文章详情页路由

也就是说前两次推上去的是个**没有任何文章的空壳**。构建先死在头像那里，压根没走到会暴露文章缺失的那一步 —— 报错信息只提了一个 jpg，实际缺了大半个站。

**改法**：加前导斜杠，锚定到仓库根。

```gitignore
/posts/
/assets/
/rescued/
/merge_posts.py
```

但 `dist/`、`node_modules/`、`.astro/` **保持不锚定** —— 那几条本来就需要匹配任意层级（`astro-site/dist/` 也要忽略）。

| 写法 | 匹配范围 |
|---|---|
| `assets/` | 任意层级的 assets 目录 |
| `/assets/` | 只有仓库根的 assets |
| `astro-site/dist/` | 指定路径（含斜杠即视为锚定） |

**教训**：加忽略规则后跑一下 `git status --short --ignored=matching`，或者对关键文件 `git check-ignore -v <文件>`，确认没有误伤。这条规则我是在 CI 失败之后才想起来验的。

## 真正的教训：本地构建不能证明 CI 能过

四个坑里有三个（一、二、四）在本地**完全无法复现**。本地 `pnpm build` 一路绿灯 29 页，因为本地工作区有全部文件 —— 而 CI 拿到的是 `git clone` 的结果，**只有提交过的文件**。

正是这个差异掩盖了第四个问题：本地有文章，git 里没有，本地构建永远告诉你「没问题」。

后来的验证方式改成了直接查 git 索引，而不是看磁盘：

```bash
git ls-files astro-site/src/content/posts/ | wc -l     # 28，对了
git ls-files --error-unmatch src/assets/images/avatar.jpg
```

**推送前值得养成的习惯**：

```bash
git add -A -n | grep -Ei "node_modules|/dist/|password"   # 别提交不该提交的
git ls-files <关键目录> | wc -l                            # 该提交的都在吗
git check-ignore -v <可疑文件>                             # 谁忽略了它
```

第三条尤其有用 —— 它会直接告诉你是 `.gitignore` 第几行干的。

## 小结

| 现象 | 根因 | 本地能发现吗 |
|---|---|---|
| Actions 完全不触发 | 分支名不存在 | 不能 |
| `Unrecognized named-value: 'secrets'` | 上下文作用域 | 不能 |
| Node 20 弃用 | 只是警告 | 不涉及 |
| 图片找不到 | gitignore 未锚定 | **不能，且误导性最强** |

最后一条最值得记：**当 CI 报「文件不存在」而本地明明有时，先怀疑 git，别怀疑路径。**
