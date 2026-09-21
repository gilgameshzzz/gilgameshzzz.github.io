---
title: "用 Archify 画请求流程图：从缓存回源到一个真实后端"
published: 2026-09-21
description: "用 Archify（agent skill，把 JSON 规格编译成可交互 HTML 架构图）画两张图：① 浏览器→API→Redis→PostgreSQL 的缓存未命中回源时序；② 一个真实 Spring Cloud 后端从网关到数据库的完整请求链路。含布局踩坑记录。"
tags: ["架构图", "Archify", "缓存", "微服务", "工具"]
category: "工程实践"
draft: false
---

> [Archify](https://github.com/tt-a1i/archify) 是一个 agent skill：你写一份类型化 JSON 规格，它校验后编译成**自包含的可交互 HTML**（明暗主题、缩放、焦点追踪、PNG/SVG/WebM 导出）。它把画图当成「编译」而不是「绘制」——布局由确定性编译器算，agent 只描述语义，所以画不出破图。
>
> 本文用它画两张图：一张是经典的缓存回源时序，一张是一个真实后端项目的请求链路。

## 一、网站请求流程：缓存优先，未命中回源并回填

最常见的读写路径：浏览器请求 API，API 先查 Redis；命中直接返回，未命中才查 PostgreSQL，把结果回填缓存后再响应。

<iframe src="/demos/archify-cache-miss-flow.html"
        style="width:100%;height:720px;border:1px solid var(--line-divider);border-radius:.75rem"
        loading="lazy" title="缓存未命中回源时序图"></iframe>

图里有三个可点的「章节」（顶部 Request / 缓存命中 / 未命中回源 / 回填与响应），点一下会把焦点收到相关参与者和消息上。

### 规格片段

Archify 的 sequence 图规格就是「参与者 + 消息 + 激活条」三张表，语义字段全是人话：

```json
{
  "diagram_type": "sequence",
  "participants": [
    { "id": "api",   "type": "backend",  "label": "API 服务",  "sublabel": "请求处理层" },
    { "id": "redis", "type": "database", "label": "Redis",     "sublabel": "缓存层" },
    { "id": "db",    "type": "database", "label": "PostgreSQL","sublabel": "权威数据源" }
  ],
  "messages": [
    { "id": "cache-read", "from": "api", "to": "redis", "y": 209,
      "label": "GET cache:{key}", "variant": "default" },
    { "id": "cache-miss", "from": "redis", "to": "api", "y": 248,
      "label": "nil（未命中）", "variant": "return" },
    { "id": "db-query", "from": "api", "to": "db", "y": 287,
      "label": "SELECT ... WHERE id = ?", "variant": "emphasis" },
    { "id": "cache-write", "from": "api", "to": "redis", "y": 365,
      "label": "SET cache:{key} EX 300", "variant": "dashed" }
  ]
}
```

`variant` 是有语义的：`emphasis` 是主路径、`return` 是返回（视觉更弱）、`dashed` 是异步/非阻塞副作用、`security` 是安全交互。**不用手写颜色**——颜色由 variant 决定，明暗主题自动适配。

### 布局踩坑（这部分是真实代价）

Archify 的校验器很严格，我这三处都被打回过：

1. **不支持自消息**。我原本加了个 `api → api` 的「序列化为缓存值」节点，报错 `spans 0px (minimum 60px)`。序列化成缓存值是实现细节，本来就该并进回填那条消息的 note 里；
2. **消息 y 间距至少 28px**。我压缩布局时把间距压到 24px，直接被判 `share horizontal space`；
3. **viewBox 加宽会让文字缩到不可读**。为了填满 2048 大屏我把 viewBox 从 1080 加宽到 1400，结果 1440×900 视口下缩放比只有 0.66，参与者副标题投影后 4.65px，低于 6px 下限被判 `desktop-readability` 失败。

第三条值得展开：**viewBox 宽度不是「画布越大越好」，它直接决定了小屏上的缩放比**。加大 viewBox 只能同比加高（保持宽高比），不能单边加宽；真正该做的是把内容在时间轴上铺得更均匀——我最后把 8 条消息从挤在 258px 改成等距铺满 273px，面板纵向饱满度上来了，宽度保持 1080 不动。

校验命令与通过标准：

```bash
node bin/archify.mjs validate sequence cache-miss-flow.sequence.json --quality showcase --json
# ok:true / composition pass / errors:0 / warnings:0 / 9 项 artifact checks 全绿
```

## 二、一个真实后端的请求链路

第二张图画的是一个 Spring Cloud 多模块后端（Java 11 + Spring Boot 2.3.12 + Spring Cloud Alibaba 2.2.6，已脱敏）。有意思的地方在于：**它恰好是第一张图的真实版本**——网关的权限校验本身就是一次「缓存优先、未命中回源」。

<iframe src="/demos/archify-backend-request-flow.html"
        style="width:100%;height:720px;border:1px solid var(--line-divider);border-radius:.75rem"
        loading="lazy" title="真实后端项目的请求链路时序图"></iframe>

这张图不是凭印象画的，每个环节都在代码里找到了出处（下表已脱敏：类名与 key 前缀改为语义描述）：

| 图中环节 | 代码证据（脱敏） |
|---|---|
| 网关鉴权是全局过滤器 | 一个 `implements GlobalFilter, Ordered` 的配置类，从自定义请求头取 token |
| **token 不是 JWT** | 鉴权服务直接 `redisTokenTemplate.opsForValue().get(tokenStr)` 反序列化出当前用户对象，取不到就抛 token 失效异常 |
| 权限走缓存回源 | Redis 里有按 API 路径组织的权限缓存 key（形如 `api-permission::{path}`），未命中时 Feign 调用户权限服务拉取并回填 |
| 权限判定分三档 | 过滤器里依次是：白名单路径（`AntPathMatcher`，支持路径变量与 `*`/`**`）→ 标记为无需授权的接口 → 比对用户的模块权限，不匹配抛 404「未知接口」 |
| 路由由配置中心动态下发 | 一个动态路由服务从 Nacos `getConfig(dataId, group, timeout)` 解析出 `List<RouteDefinition>` 写入 `RouteDefinitionWriter`，并 `addListener` 做热更新 |
| 服务间走 OpenFeign | 仓库内 7 个 `@FeignClient`，按注册中心服务名调用 |
| 双数据库分工 | 主库 MySQL（`mysql-connector-java` + JPA，空间数据用 MySQL8 Spatial 方言）；采集/GIS 侧模块另有 `org.postgresql` 依赖 |
| 异步消息走 Kafka | `spring-kafka` 出现在公共模块与两个业务模块；topic 含设备上行、OTA 推送、配置刷新 |
| 对象存储 | `MinioClient`（数十处引用）+ 少量其他云 OSS SDK |
| 外部审批往返 | 对接企业 IM 开放平台（引用最多的一类外部依赖），含专用回调 Controller |

**这里有个判断值得说**：查代码时我发现「数据库是 MySQL 而不是 PostgreSQL」——虽然采集侧确实有 PostgreSQL 依赖。如果只看依赖列表画图，很容易画成「全部走 PostgreSQL」。**画图前先确认主链路用的是哪个数据源**，比画得好看重要。

### 为什么这张也画成时序图，而不是架构图

我第一版确实画的是 architecture（组件 + 边界 + 连线），**校验器直接判死**：

```
[clean-flow/edge-through-node]   A -> 对象存储 crosses component "主库"
[composition/proper-crossing]    网关 -> 用户服务 crosses 网关 -> Redis
[composition/ambiguous-corridor] 两条边共用 60px 通道
[composition/micro-segment]      B -> Kafka 出现 7px 内部线段
```

在 3×4 的组件网格里，网关既要连上面的 Redis、用户服务、配置中心，又要连右边的业务服务——长连线必然穿过中间节点。**这不是我不会摆位置，是这类拓扑在网格布局下的固有问题。**（上面的组件名已改为通用称呼，错误码是校验器的原样输出。）

改画时序图之后，同样的信息变成了纵向时间轴，天然没有交叉。而且顺序本身就是信息：「鉴权 → 权限回源 → 转发 → 落库 → 异步通知」是一条线，架构图上这些箭头是散的。

选型的经验是：**想表达「谁调用谁、系统里有什么」用 architecture；想表达「一次请求怎么流转、先后顺序是什么」用 sequence。**用户问的是「请求流程」，那答案就是 sequence。

### 布局踩坑（第二张）

1. **时间轴有硬边界**。12 条消息最后一条排在 y=483，被判 `sits outside the readable timeline — keep y between 160 and 477`。viewBox 高度决定了可用时间轴范围，超了就得压缩间距或增高画布；
2. **说明卡片会把页面撑到滚动**。我的三张卡片每条写了 50-70 字，在 1440×900 视口下总高度 944px（超 44px）。把每条压到 38 字以内、回到第一张图的密度，恰好 900px 无滚动。**卡片文字长度是布局变量，不是文案变量**——这是最容易忽略的一条。

## 三、这个工具适合什么场景

**适合**：架构评审、新人 onboarding、ADR（架构决策记录）、PR 里贴一张链路图、把已有的 Mermaid 转成能交互的版本（它能读 Mermaid 拓扑再重新生成，不是机械转样式）。

**不适合**：随手画的草图（写 JSON 规格的成本比拖拽高）、需要精确像素控制的设计稿。

**最有价值的特性其实是「校验」**。传统画图工具能让你画出边穿过节点、标签压住连线、两张图对不上的东西；Archify 把这些当编译错误：

| 校验项 | 挡住的问题 |
|---|---|
| `relationship_crossings` | 边穿过无关节点 |
| `relationship_corridors` | 多条边挤在同一通道，分不清谁是谁 |
| `label_route_clearance` | 标签压住连线 |
| `route_rhythm` | 拐折过多、线段过短（视觉噪声） |
| `desktop-readability` | 小屏下文字缩到不可读 |

加上 `deliver` 会冻结规格快照、报告 SHA-256 和字节数，`visual-check` 再用真实浏览器在 1440×900 / 1600×1000 / 1920×1080 / 2048×1320 四个视口截图验证无溢出——**图和代码一样有了可验证的交付证据**，这是它和普通画图工具最本质的区别。

> 本文两张图的规格 JSON 都在仓库 `diagrams/` 目录下，可以直接 `node bin/archify.mjs deliver` 复现。
