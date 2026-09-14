---
title: "requests 带 cookie 请求百度接口拿不到数据"
published: 2019-04-19
description: "Postman 里只填 BDUSS 就能拿到数据，Python requests 照抄却是空的——差在 Postman 自动补上的 BDPPN。"
tags: ["Python", "requests", "踩坑"]
category: "问题排查"
draft: false
---

## 问题

调用百度某个接口时，Postman 里只需要在 Cookie 里填 `BDUSS` 就能拿到数据；但用 Python `requests` 同样只传 `BDUSS`，返回的却是空内容。

把浏览器上的 cookie 整个复制过去就正常了，一时看不出是哪一项在起作用。

## 原因

逐项排除后发现，Postman 除了我自己填的 `BDUSS`，还额外带了一个 `BDPPN`。Python 这边补上这两个就能取到数据：

```python
import requests

cookies = {
    "BDUSS": "...",
    "BDPPN": "...",
}
resp = requests.get(url, cookies=cookies)
```

`BDUSS` 和 `BDPPN` 都是百度自己定义的 cookie 名。

## Postman 是怎么知道要带 BDPPN 的

把 Postman 里的 cookie 全部删掉重试：

1. 第一次访问拿不到内容，但响应里带了 `Set-Cookie`，Postman 把它存进了自己的 cookie jar；
2. 第二次访问时 Postman 自动带上了这个 `BDPPN`，于是有数据了。

也就是说 Postman 默认维护会话状态，而裸写的 `requests.get()` 不会。

## 更好的写法

用 `requests.Session()`，它同样会自动处理 `Set-Cookie`，行为就和 Postman 一致了，不用手工抄 cookie：

```python
import requests

with requests.Session() as s:
    s.cookies.set("BDUSS", "...")
    s.get(url)        # 第一次：服务端下发 BDPPN，session 自动存下
    resp = s.get(url) # 第二次：自动带上，拿到数据
```
