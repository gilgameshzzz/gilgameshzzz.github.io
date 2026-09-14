# 加密文章密码

`post-passwords.json` 保存 slug -> 密码 的映射，**已被 gitignore，不会进仓库**。

```json
{
  "my-private-note": "correct-horse-battery-staple",
  "another-post": "另一个完全不同的密码"
}
```

对应文章的 front-matter：

```yaml
---
title: 我的私密笔记
published: 2026-09-15
protected: true
passwordHint: 我们第一次见面的城市   # 可选，会公开显示
---
```

## 注意

- 这份文件丢了就没法重新构建那些文章了，请自行备份（密码管理器 / 私有仓库）。
- 构建时如果某篇标了 `protected: true` 却查不到密码，构建会直接失败，
  而不是把正文明文发出去。
- 换密码后重新构建即可，旧密文会被覆盖。

## 安全边界

密文和 KDF 参数都会公开发布，攻击者可以下载页面离线暴力破解。
唯一的防线是**密码强度**（PBKDF2 31 万轮只是抬高单次尝试成本）。

- 用长随机密码，别用生日、姓名拼音、常见单词
- 适合「不想公开、泄露了也不致命」的内容
- **不要**放公司资料、凭据、真正的隐私信息
