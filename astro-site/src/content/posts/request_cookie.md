---
title: "request_cookie"
published: 2019-04-19
description: "================================"
tags: ["问题"]
category: ""
draft: false
---

# 今天调用百度接口时，postman只需要传入BDUSS的内容就能获取数据，但在python requests的请求时，也传入BDUSS部分cookie，却不能获取数据。

# 折腾半天，把浏览器上cookie全部复制传入，就能获取数据了。也不知道咋回事，知道的老哥请解答一下。

================================

# 解决了，是因为postman 除了自己填写的BDUSS还添加了BDPPN,所以python代码加上BDUSS和BDPPN也能获取数据。（BDUSS和BDPPN是百度自己设置的名字，也不知道postman是怎么知道要带上这个。）

================================

# 把postman上的cookie删除后，第一次访问，拿不到内容，但是会设置cookie，第二次访问，就有数据了（可能是第一次访问后，postman获取了BDPPN。第二次再访问时，就带上了BDPPN。）
