---
title: "用 Archify 画高层系统架构图：11 个组件，只画 10 条线"
published: 2026-09-22
description: "把上一篇文章里「校验器直接判死」的 architecture 图画成了：11 个运行时组件、一条主请求路径、外部依赖、两层信任边界。含为什么画整个项目而不是单个微服务，以及让长连线不穿节点的布局规则。"
tags: ["架构图", "Archify", "微服务", "系统设计", "工具"]
category: "工程实践"
draft: false
---

上一篇[《用 Archify 画请求流程图》](/posts/archify-request-flow-diagrams/)里我写过一句结论：

> 我第一版确实画的是 architecture（组件 + 边界 + 连线），**校验器直接判死**。……这不是我不会摆位置，是这类拓扑在网格布局下的固有问题。

这句话对了一半。错的那一半是「固有」——真正的问题不是图型，是**我的布局策略**。这次我把那张图画出来了，showcase 档 9/9 项检查、0 errors 0 warnings，四个视口全部无溢出。

画的对象是同一个仓库：一个 Java 11 + Spring Boot 2.3.12 + Spring Cloud Alibaba 2.2.6 的多模块后端（已脱敏）。

<iframe src="/demos/archify-backend-architecture.html"
        style="width:100%;height:760px;border:1px solid var(--line-divider);border-radius:.75rem"
        loading="lazy" title="真实后端项目的高层系统架构图"></iframe>

图顶部有三个可点章节：**主请求路径**（浏览器→网关→业务服务→主库）、**信任边界与鉴权**（网关的会话校验与权限回源）、**数据域与异步**（空间库、对象存储、事件总线）。点一下会把焦点收到相关组件上，其余变淡。

## 一、画整个项目，不画单个微服务

需求给的是「每个微服务或者整个项目，取决于哪个更方便阅读」。我选了整个项目，理由是证据层面的：

这个仓库有 11 个 Maven 模块（10 个可独立部署的服务 + 1 个公共库），但它们**共用同一套底座**——同一个网关、同一个注册中心、同一个 Redis、同一个 Kafka、同一套权限缓存。把任一模块单独拿出来画，得到的是「一个盒子 + 几个箭头指向公共组件」，公共组件在每张图里重复出现，读的人得自己在脑子里做拼接。**架构的信息量在模块之间的关系里，不在模块内部。**

反过来说，如果某个微服务有独立的数据库、独立的消息主题、独立的部署边界（比如一个单独的实时计算链路），那它就值得单独一张图。判断标准很简单：**这张图里有没有只属于这个组件的东西？** 如果所有连线都指向共享底座，就该画整体。

## 二、11 个组件是怎么从代码里挑出来的

不是按模块列表照搬（那样会有 11 个一模一样的业务盒子），而是按**运行时角色**归并：

| 图中组件 | 归并依据（脱敏，数字为实测） |
|---|---|
| API 网关 | 一个 `implements GlobalFilter, Ordered` 的配置类，全仓库唯一公网入口 |
| 业务服务组 · 流程域 | 4 个不持空间库/对象存储、以在线请求为主的模块 |
| 业务服务组 · 数据域 | 4 个持有 PostgreSQL 或 MinIO 或 Kafka 依赖的模块 |
| 用户权限服务 | token 与权限的权威源，网关缓存未命中时回源到这里 |
| Redis | 全仓库 157 个 Java 文件引用，跨 10 个服务；会话、权限缓存、分布式锁三种用途 |
| Nacos | 动态路由服务从配置中心解析 `List<RouteDefinition>` 并 `addListener` 热更新 |
| MySQL / PostgreSQL | 主链路是 MySQL（`mysql-connector-java` + JPA）；数据域 2 个模块的 pom 另有 `org.postgresql` |
| Kafka | `spring-kafka` 出现在公共库与 2 个数据域模块 |
| MinIO | 对象存储，90 处引用，集中在数据域的 4 个模块 |

11 个盒子正好落在「8–12 个核心运行时组件」这个区间——**不是因为凑数，是因为归并到运行时角色之后自然就剩这么多**。原本 8 个业务服务被压成 2 个业务服务组（流程域 + 数据域），网关和用户权限服务因为是信任边界上的关键角色单独成盒，省下来的位置留给了基础设施。

> 分组不是拍脑袋的：我按「是否持有 PostgreSQL / MinIO / Kafka 依赖」把 8 个业务模块二分，恰好各 4 个。这个判据比「按名字猜职责」可靠，因为依赖写在 pom.xml 里，跑不掉。

外部依赖的处理：**浏览器**画成 `external` 放在集群边界外，**Nacos / MinIO / Kafka** 画在集群内（它们是自建组件，不是外部 SaaS）。这里有个容易画错的地方——如果 MinIO 是买的对象存储服务，它就该在边界外；自建在 K8s 里，就在边界内。**边界画的是信任范围，不是技术类型。**

## 三、让长连线不穿节点的四条规则

上次判死的四个错误码是 `edge-through-node`、`proper-crossing`、`ambiguous-corridor`、`micro-segment`。这次的布局只有四条规则，全部来自上次的失败：

**1. 主路径先横后竖，全程不拐弯。** 浏览器、网关、流程域三个盒子排在中间一行，MySQL 在流程域正下方——所以三段 `emphasis` 是「两段水平 + 一段垂直」，每段都是轴对齐直线，没有任何斜线。主路径是图的骨架，骨架一歪，其它边就没有参照。

**2. 每个组件最多 4 条边，且每条边占一个不同的 side。** 网关正好四条边占满四个方向：左←浏览器（入站）、右→流程域（主路径）、上→Redis（会话）、下→用户服务（权限回源）。四个方向互不抢通道，`ambiguous-corridor` 就不会触发。上次的错误是网关一个盒子往四个方向发散，其中两条边共用了 60px 通道。

**3. 跨列的边必须给显式 `via` 走廊，不能斜穿。** 唯一一条需要拐弯的边是流程域→MinIO（跨一列一行），我给了 `fromSide: right` + `toSide: top` + 一个折点，让它走 L 形而不是对角线。对角线在网格里必然穿过某个盒子。

**4. 标签位置自己算，别交给默认。** 三个纵向边的标签默认落在边中点，而中点正好在两个盒子之间的空隙里——校验器报了三次 `Label overlaps component`，并且直接给出了建议坐标：

```
Label "SQL" overlaps component "biz_flow" — adjust labelDx/labelDy/labelSegment or set labelAt.
  label rect: [477, 288, 30, 14]
  component "biz_flow" rect: [424, 250, 136, 58]
  Suggested fix: labelAt [492, 322] or labelDy +24 (below)
```

我把三个标签统一挪到 B 行底与 C 行顶的中点（y=364），一次通过。**Archify 的报错带具体坐标和修复建议**，这点比大多数校验器友好——它不是告诉你「布局不好看」，是告诉你「这个矩形和那个矩形重叠了，挪到这里」。

## 四、信任边界怎么表达

两层边界，对应两种归属：

```json
"boundaries": [
  { "kind": "region", "label": "K8s 生产集群 · production", "pad": 26,
    "wraps": ["gateway", "biz_flow", "biz_data", "redis", "registry",
              "kafka", "user", "mysql", "pg", "minio"] },
  { "kind": "security-group", "label": "数据层 · 不暴露公网，仅集群内可达", "pad": 15,
    "wraps": ["mysql", "pg", "minio"] }
]
```

外层 region 圈住「我们的东西」，把浏览器排除在外——这是第一个信任断点。内层 security-group 圈住数据库和对象存储，表达「这一层不接受任何集群外流量」。

组件的 `tag` 字段用来标归属：网关、Redis、Nacos、Kafka 标「平台组」，业务服务标「业务组」，数据库和对象存储标「DBA」。**归属和信任边界是两件事**：边界说的是「谁能访问」，tag 说的是「谁负责」。一张图能同时表达这两个维度，比只画网络拓扑有用得多——架构评审上被问「这个组件谁维护」时，答案就在图里。

`meta.views` 则是把「不同人关心不同部分」显式建模：给业务同学看主路径，给安全同学看信任边界，给数据同学看数据域。同一张图三个视角，不用维护三张图。

## 五、卡片是布局变量，不是文案变量

这条上一篇说过，这次得到了一个干净的量化验证。

我原本写了 4 张卡片，其中一张是「为什么只有 10 条连线」——关于图本身的元评论。`visual-check` 在 1440×900 下报溢出 138px。

删掉那张卡片，恰好 900px，四个视口全绿。但我没有停在这个结论上，又单独跑了一次对照实验：**把卡片加回 4 张，viewBox 保持删卡片后的值**。

| 配置 | 1440×900 | 1600×1000 | 1920×1080 | 2048×1320 |
|---|---|---|---|---|
| 4 卡片 + viewBox 570 | 溢出 +138 | 溢出 +120 | 通过 | 通过 |
| **3 卡片 + viewBox 540** | **900 恰好** | **1000 恰好** | **通过** | **通过** |
| 4 卡片 + viewBox 540 | 溢出 +121 | 溢出 +103 | 通过 | 通过 |

第三行说明问题不在 viewBox：**缩小画布只让溢出从 138 变成 121，卡片数量才是主变量。**一张 4 条目的卡片约等于 120px 纵向空间，而 1440×900 视口下页面可用高度只有 900px。

所以「支持性细节放进卡片，不要继续堆连线」这条要求有个隐藏代价：**卡片也不能无限堆。**3 张、每张 4 条目、每条 ≤38 字，是 1440×900 下的实际上限。

那张被删的卡片去哪了？就是你现在读的第三节。**关于图的元评论属于文档，不属于图**——图里的卡片应该只放领域事实（信任边界怎么划、两套库怎么分工、哪些事实没画进连线）。删掉它同时改善了两个东西：布局通过了，图的信噪比也上去了。

## 六、连线数量本身就是设计决策

11 个组件两两相连最多 55 条边。我只画了 10 条。

砍掉的 45 条去哪了？进了卡片。比如「服务间共 7 个 Feign 客户端」——如果每个 Feign 调用都画一条线，流程域和数据域之间会出现 7 条平行边，`ambiguous-corridor` 立刻触发，而且读的人也看不出重点。**「有多少个 Feign 客户端」是一个数字，不是一条关系**，数字属于卡片。

判断一条关系该不该画进图，我用的是三个问题：

1. **它在主路径上吗？** 在 → `emphasis`
2. **它跨越信任边界吗？** 跨 → 必须画，用 `security` 或 `dashed`
3. **它是一条关系，还是一个数量/属性？** 数量 → 进卡片

按这三条筛完，剩下的正好是「一条主路径 + 三层信任穿越 + 两条数据依赖」。这才是「高层」架构图的含义：**不是画得少，是画的都是跨越边界的、或者构成主干的。**

## 七、校验命令与通过标准

```bash
# 1. 布局校验（含 composition 档）
node bin/archify.mjs validate architecture backend-system-architecture.architecture.json \
  --quality showcase
# ok architecture ... (9 artifact checks; composition showcase: 0 errors, 0 warnings)

# 2. 生成自包含 HTML（冻结规格快照 + SHA-256）
node bin/archify.mjs deliver architecture ... --quality showcase
# 9/9 artifact checks; composition showcase: pass; sha256 bf383fdab4f9

# 3. 真实浏览器四视口验证
node bin/archify.mjs visual-check backend-system-architecture.html --json
# status: pass / containment: pass / readability: pass / viewerChrome: pass
```

三步的分工很清楚：`validate` 管布局语义（有没有边穿节点、标签重叠、通道冲突），`deliver` 管产物完整性与可复现性，`visual-check` 管真实渲染结果（启 Chrome 在四个视口截图，断言 `scrollHeight <= innerHeight`）。**第三步是唯一能发现「卡片太多」的手段**——前两步都不知道页面会溢出。

> 本文图的规格 JSON 在仓库 `diagrams/backend-system-architecture.architecture.json`，可直接 `deliver` 复现。
>
> 配套阅读：[用 Archify 画请求流程图](/posts/archify-request-flow-diagrams/)（同一个仓库的 sequence 视角，以及 architecture 与 sequence 的选型经验）。
