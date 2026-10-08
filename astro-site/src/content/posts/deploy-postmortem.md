---
title: "一次 GitHub Pages 部署的四连翻车复盘"
published: 2026-09-15
description: "从 Hexo 迁到 Astro 后首次部署，连续踩了四个坑：不存在的分支、secrets 上下文误用、Node 20 弃用警告、以及最坑的 .gitignore 模式未锚定导致整站文章没进仓库。"
tags: ["GitHub Actions", "CI/CD", "Git", "踩坑"]
category: "工程实践"
protected: true
passwordHint: "密码不公开。作者本人见 PASSWORD-RECOVERY.md；其他读者请按该文件说明向我索要。"
draft: false
---

<!-- 正文已加密，密文在 astro-site/encrypted/ 下，明文草稿在本地 private/drafts/ -->
