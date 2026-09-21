---
title: "全栈深水区复盘：11 个技术点的为什么与怎么答"
published: 2026-09-21
description: "两套真实系统（Java/Spring 全栈 + Python/FastAPI 全栈）里 11 个容易被问倒的技术点，逐个讲清楚是什么、为什么这么设计、面试会怎么问、30 秒怎么答。"
tags: ["面试", "全栈", "工程实践", "自动驾驶"]
category: "工程实践"
protected: true
passwordHint: "复习自查用；密码见本地 secrets（与 deploy-postmortem 同处管理）"
draft: false
---

这份是**自查复习材料**，不是对外吹嘘。起因是发现自己做过的一些深水区技术点，时间一长细节就模糊——而面试官专挑模糊的细节问。所以逐个把"是什么 / 为什么这么设计 / 面试会怎么问 / 30 秒怎么答"重新理一遍。

分两大块：上半是 Java/Spring 全栈（车云链路相关）5 个点，下半是 Python/FastAPI 全栈（挖掘平台）6 个点。两大块结尾有一张**同构对照表**——同样的工程问题在两套技术栈里各自怎么解，迁移着讲更容易。

<!-- more -->

## 先认架构：两个系统长什么样

11 个技术点都挂在两个真实系统上。先认清楚架构——面试官最爱问"讲讲你项目架构"，而且很多技术点的"为什么那么设计"要从架构里解释。

### 系统一：data-platform-service（Java / Spring Cloud 多模块微服务）

**一句话**：自动驾驶数据闭环平台后端，Spring Cloud 微服务，Maven 多模块，11 个 `ndp-*` 子服务 + 1 个公共模块。

**模块划分**（每个 `ndp-*` 是一个独立微服务）：

| 模块 | 职责 |
|---|---|
| `data-common` | 公共：DTO、工具、公共配置，被各服务依赖 |
| `ndp-gateway` | 网关：鉴权、限流、路由 |
| `ndp-user` | 用户服务 |
| `ndp-requirement` | 采集需求服务（接手）：需求工单、漏斗状态机、流转留痕 |
| `ndp-collection` | 数据采集服务（接手）：车端下发、采集任务、车云链路 |
| `ndp-car` | 车端服务 |
| `ndp-cal` | 标定服务（calibration） |
| `ndp-marking` | 标注服务 |
| `ndp-map` | 地图服务 |
| `ndp-releasehub` | 发布库服务 |
| `ndp-deploy` | 部署服务 |

**单模块内的 Java 分层**（以 `ndp-collection` 为例）：

```
ndp-collection/src/main/java/.../collection/
├── config/        # 配置类（@RefreshScope 热更新 vs @ConditionalOnProperty 重启生效）
├── constant/      # 常量
├── entity/        # JPA 实体（按子域分：collecttype/datacollection/requirement/param/vo）
│                  #   关键：实体零关联注解，全逻辑外键 → 防对象图懒加载 N+1
├── enums/         # 枚举（FlowNodeEnum / RequirementStatusEnum，状态机在这）
├── feign/         # Feign 客户端（跨服务调用）
├── jpa/           # JPA 适配/配置
├── repository/    # 仓储层（impl / projection，零关联实体的查询在这）
├── schedule/      # 定时任务
├── service/       # 业务层
│   ├── impl/      #   实现
│   ├── helper/    #   辅助（按子域分）
│   ├── qc/        #   质检（quality check）
│   └── support/   #   支撑
├── vehiclelink/   # ⭐ 车云链路：SSH 版 + 链路(Kafka)版两套并行，前端灰度切换
├── web/           # Controller 层
└── util/          # 工具
resources/db/
├── migration/     # 数据库迁移脚本
├── backfill/      # 数据回填脚本
└── permission/    # 权限脚本
```

**三个关键的架构判断**（面试可讲）：

1. **跨模块共库直读，不走 Feign / MQ**：`ndp-collection` 校验和推进 `ndp-requirement` 的状态，直接读/写 requirement 的表，两边没有回调也没有消息。判断依据是"同团队同扩缩容"——该共库时不用 Feign，写侧失败只告警不抛（`task_ref` 是跨服务快照，不能让它打断采集主流程）。
2. **`@RefreshScope` vs `@ConditionalOnProperty` 的热更新差异**：带 `@RefreshScope` 的配置类，Nacos 改完热更新不重启 pod；`@ConditionalOnProperty` 是装配期读取，改了必须重启。所以"可能来回切"的业务开关优先放进 `@RefreshScope` 配置类。
3. **`vehiclelink` 两套实现灰度并存**：SSH 版（同步直连）和链路版（Kafka 异步长任务）是两套并行代码，前端按开关灰度切换。后果是两边的 `start / redispatch / recollect / stop` 都要落操作留痕，否则灰度切换后留痕断档。

### 系统二：mining-platform（Python / FastAPI 单服务模块化）

**一句话**：AI 大模型挖掘实验平台后端，FastAPI 单服务 + 模块化，Python 异步。

**目录结构**：

```
mining-platform/
├── app/
│   ├── main.py           # FastAPI 入口（含 _start_background_workers 启 worker）
│   ├── core/             # 公用基础设施
│   │   ├── config.py     #   配置（dev/prod 分环境，.env 覆盖链）
│   │   ├── database.py    #   异步数据库（SQLAlchemy + aiomysql）
│   │   ├── kafka_client.py #   Kafka 发送（Producer 配置维度缓存）
│   │   ├── redis_client.py
│   │   ├── redis_lock.py  #   ⭐ 分布式锁（fence token + Lua CAS + watchdog）
│   │   ├── async_runtime.py
│   │   ├── baidu_sdk.py   #   BOS 对象存储 SDK 封装
│   │   ├── pagination.py / sorting.py
│   │   └── constant/      #   常量收敛（batch_task/quality/kafka/experiment/inference/review）
│   ├── middleware/       # 中间件（异常处理 / 请求日志 / 用户上下文）
│   ├── models/           # ORM（14+ 张表：batch_task/demand/experiment/inference/mining_rule/quality/review...）
│   └── modules/          # 业务模块（每个模块三层）
│       ├── batch_task/   #   api/ + schemas/ + services/（批量任务）
│       ├── demand/       #   需求
│       ├── experiment/   #   实验
│       ├── inference/    #   推理
│       ├── mining/       #   挖掘规则
│       ├── quality/      #   质检
│       ├── review/       #   审核（抽样在这）
│       ├── bos/          #   对象存储预签名
│       └── clip_query/   #   片段查询
├── worker/               # 后台轮询进程（inference_poller / batch_task_worker / poller / pipeline_client）
├── pipeline/             # 数据流转（data_transfer / bos_pfs_transfer）
├── scripts/              # 运维脚本（init_db / migrate_db / 建表 SQL / 回填脚本）
├── migrations/          # 数据库迁移
├── k8s/                  # k8s 部署
├── tests/                # 测试
└── docs/ + doc_auto/     # 设计文档 + 自动生成对接文档
```

**三个关键的架构判断**（面试可讲）：

1. **模块内三层（api / schemas / services）**：每个业务模块统一 api（路由）+ schemas（Pydantic 模型）+ services（业务逻辑），和 Java 的 web/service/repository 对应但更轻。跨模块的重复逻辑收敛到 core（如 `resolve_id_name_map` 统一 id→name 映射防 N+1）。
2. **worker 与 API 进程分离**：API 进程（uvicorn）处理请求，worker 进程（poller）后台轮询推进异步任务（推理状态、批量任务状态）。API 进程里也可通过开关 `ENABLE_BATCH_TASK_WORKER` 内嵌轮询，但生产用独立 worker 进程隔离故障。
3. **配置与凭据分离**：工程内不维护 Kafka 配置（全由调用方请求体传入），凭据不进仓库（`secrets/` 被 gitignore）。这和 Java 侧"Nacos 管配置"是两种风格——Python 侧更"无状态"，配置由调用方负责。

### 两套架构对照

| 维度 | data-platform-service（Java） | mining-platform（Python） |
|---|---|---|
| 架构风格 | 微服务多模块（11 服务） | 单服务模块化 |
| 构建 | Maven 多模块 | 单包 + uv/pip |
| 分层 | web/service/repository + entity/enum/feign | api/schemas/services + models |
| 跨模块通信 | 共库直读（同团队）/ Feign（跨团队） | 进程内调用（单服务） |
| 后台任务 | schedule 定时 | worker 独立进程轮询 |
| 配置 | Nacos + @RefreshScope 热更新 | .env 分环境 + 调用方传入 |
| 状态机 | FlowNodeEnum / RequirementStatusEnum + 漏斗 | 批量任务状态机 + DP 状态聚合 |

**记忆要点**：Java 侧是"重架构、强规范"（微服务拆分、Nacos、Feign、JPA），Python 侧是"轻架构、快迭代"（单服务、worker、Pydantic）。两个都做过，面试讲架构时能对比着讲，比只会一边有纵深。

---

## 一、Java/Spring 全栈（车端到云端）

### 1. 连接池治理：HikariCP 僵尸连接事故

**是什么**

生产环境四个 pod 的 HikariCP 连接池同时雪崩，应用拿不到连接、请求堆积超时。根因是 Spring Boot 2.3.12 默认带的 HikariCP 3.4.5 **不支持 `keepaliveTime` 主动探活**，叠加四层负载均衡器与 MySQL `wait_timeout` 会在应用不知情时异步杀掉空闲连接，池子里留下的就是"应用以为是好的、实际已被对端关闭"的**僵尸连接**——下一个请求借出去才发现连不上。

**为什么这么设计（踩的坑）**

修的时候有个取舍：是只升 HikariCP 3.4.5 → 4.0.3（4.0 起支持 `keepaliveTime` 主动探活），还是顺带升 Spring Boot。

- 顺带升 Spring Boot 是"标准答案"，但当时不能做全量回归——升框架要回归整个微服务集群的业务，风险面太大。
- 只升 HikariCP 一个组件，爆炸半径最小，回归面只到连接池这一层。

所以选了最小爆炸半径：单独升 HikariCP 到 4.0.3，配 `keepaliveTime` 让池子主动探活僵尸连接；再配 `maximum-pool-size=20`，防止应用 `stop` 时连接没及时归还导致卡死。

**面试会怎么问**

- "为什么不直接升 Spring Boot？" → 考的是有没有"最小爆炸半径"的工程判断，而不是只会照搬"升级到最新"。
- "僵尸连接和连接泄漏是一回事吗？" → 不是。泄漏是应用借了不还（池子统计 active 一直涨）；僵尸是连接被对端关了但池子不知道（借出去才炸）。前者查代码未关闭，后者查 keepalive + 对端超时。

**30 秒答法**

> 修过一次四 pod 连接池雪崩，根因是 HikariCP 3.4.5 不支持 `keepaliveTime` 主动探活，叠加四层负载均衡器和 MySQL `wait_timeout` 异步杀连接产生僵尸连接。我只升了 HikariCP 到 4.0.3，没顺带升 Spring Boot——最小爆炸半径，这是当时不能做全量回归逼出来的判断。配 `keepaliveTime` 探活 + `maximum-pool-size=20` 防 stop 卡死。

---

### 2. 状态机设计：漏斗恒等约束 + 车云链路看门狗

**是什么**

两套状态机，一个真做过、一个读过动手：

- **需求漏斗状态机**（做过）：6 个节点联动，核心是一条**恒等约束** `回传 ⊆ 质检 == 采集`——意思是"采集成功的总量"必须等于"进入质检的总量"，"回传的量"是其中的子集。这条约束排除了"采集成功但质检没有"这种非法状态。
- **车云链路 JobState**（读过动手）：九个状态、四个终态（SUCCESS/STALLED/RETRY_WAIT 等），终态幂等——在"至少一次投递"语义下，重复消息落到终态不会出错。配套 **JobWatchdog 看门狗**扫描超时与失联。

**为什么这么设计（踩的坑）**

- **3/4 枚举互换的坑**：状态枚举的 3 和 4 在某个版本里被互换过，导致历史数据读到反的状态。从此定规矩——状态枚举只追加不互换，值用枚举名不用数字。
- **partial 放行但不完成**：漏斗里允许部分环节"放行"（数据可以往下走），但整个漏斗不能因此标记"完成"——完成必须是全部环节都到终态。这是为了防止"放行"被误读成"完成"。
- **STALLED 是可恢复态，不是终态**：车进隧道 5G 断连，看门狗判它失联——但这是 STALLED（疑似失联、可恢复），不是 FAIL（终态）。出隧道恢复就继续，不误杀。SSH 版本没有看门狗，干等 6 分钟超时才判失败；链路版本主动判 STALLED 并可重试，这是两套实现的核心差异之一。

**面试会怎么问**

- "恒等约束怎么保证？" → 不是靠运行时校验兜底，是靠状态转移图的设计从根上排除非法路径——"采集成功但质检失败"这条转移根本不存在。
- "STALLED 和 FAIL 为什么要分开？" → 一个可恢复一个不可恢复。混在一起，车进一次隧道就被判死，恢复后无人接续。

**30 秒答法**

> 设计过需求漏斗状态机，有条恒等约束：回传 ⊆ 质检 == 采集，"采集成功但质检失败"在我们系统里这条转移根本不存在。车云链路那套九状态四终态，关键是 STALLED 是可恢复态不是终态——车进隧道断连判失联，出隧道恢复就继续，不误杀。看门狗扫超时和失联做兜底。

---

### 3. 持久层治理：JPA 防 N+1 + 共库直读 vs Feign

**是什么**

两个工程判断：

- **JPA 防两种 N+1**：实体类**零关联注解**（0 个 `@OneToMany`/`@ManyToOne`），全用逻辑外键，从根上没有对象图懒加载 N+1；但还有"手动 N+1"——循环里逐条查，用 `collect id → 批量 IN → Map 索引` 统一兜住。
- **共库直读 vs Feign**：同团队、同扩缩容的两个模块，数据共享**直接读对方的库**（只读视图），而不是走 Feign 跨服务调用。

**为什么这么设计（踩的坑）**

- **空集合短路**：修过一个 N+1，根因是"列表装配"环节写了个空集合判断——空集合直接 `return`，于是那批 id 永远没进批量查询，到后面循环里又逐条查。教训：空集合要短路的是"返回空结果"，不是"跳过查询"。
- **共库直读的取舍**：Feign 是微服务规范答案，但同团队同扩缩容的两个模块走 Feign 纯属增加故障面（一次网络抖动就让快照失败）。共库直读的代价是耦合了对方表结构——但同团队这个代价可接受。关键判断是**写侧失败只告警不抛**：共库直读如果写侧快照失败，只记告警，不让跨服务的失败打断主流程。

**面试会怎么问**

- "N+1 有几种？各怎么防？" → 两种。对象图懒加载 N+1：靠零关联注解从根上没有；手动逐条查 N+1：靠 collect id → 批量 IN → Map 索引。
- "什么时候不该用 Feign？" → 同团队同扩缩容、且对方失败不该阻断主流程的场景。这是反教条判断——规范说用 Feign，但工程上该共库就共库。

**30 秒答法**

> JPA 实体零关联注解，从根上没有对象图懒加载 N+1；手动 N+1 用 collect id → 批量 IN → Map 索引统一兜。共库直读 vs Feign 我选共库——同团队同扩缩容，该共库时不用 Feign，知道什么时候不该教条。写侧失败只告警不抛，不让跨服务快照打断主流程。

---

### 4. 前端可视化：点云请求调度

**是什么**

自动驾驶点云预览，难点不在渲染，在**请求调度**。三格式支持：pcd / drc（DRACO 压缩）/ potree（八叉树 LOD）。核心是 potree 的请求调度改造。

**为什么这么设计（踩的坑）**

- **potree-core 原生 fetch 不带鉴权**：potree 库直接 `fetch(url)` 取瓦片，不带任何鉴权头。直接用就裸奔。改造：把请求重写到自己的逻辑源，在那里换成**签名 URL**（带时效签名的对象存储直链）。
- **签名 URL 复用 Promise Map**：同一瓦片可能被多个 LOD 节点同时请求，用一个 Promise Map 去重——同一个 URL 飞一个请求，多个等待者共享结果。
- **完整响应缓存做 Range 切片**：对象存储的请求如果按 Range 一次次取，小请求多、握手成本高。改成把完整响应缓存下来，后续 Range 请求从缓存里切，减少回源。
- **50MB 降级**：单文件超 50MB 不再走完整缓存（内存撑不住），降级回 Range 实时取。
- **DRACO 全局单例 + worker 限制**：DRACO 解码器初始化重，全局单例复用；decoder worker 数量限制，防并发解码把浏览器搞崩。
- **proj4 + 自写 GCJ02**：坐标转换用 proj4，但 GCJ02（火星坐标）的 `out_of_china` 判断（是否在中国境内、要不要偏转）是自己写的——这是合规相关的坑。

**面试会怎么问**

- "potree 为什么不直接用它的 loader？" → 鉴权。potree 原生 fetch 不带 header，必须重写到逻辑源换签名 URL。
- "50MB 为什么是分界点？" → 内存。完整缓存一个 50MB 的响应还能接受，再大浏览器内存吃紧，降级回 Range 实时取是内存和请求数的权衡。

**30 秒答法**

> 点云预览难点是请求调度不是渲染。potree 原生 fetch 不带鉴权，我把请求重写到逻辑源换签名 URL，用 Promise Map 去重复请求，完整响应缓存做 Range 切片减少回源，超 50MB 降级回实时 Range 防内存爆。DRACO 全局单例 + worker 限制。坐标 proj4 + 自写 GCJ02 的 out_of_china 判断。

---

### 5. 车云链路：SSH 同步直连 vs Kafka 异步长任务

**是什么**

车端任务下发有两套实现，灰度并存：

- **SSH 同步直连**：云端直接 SSH 到车端工控机执行命令，同步等待结果。
- **Kafka 异步长任务**：下发消息进 Kafka，车端消费执行，状态机 + 看门狗管理异步生命周期。

**为什么这么设计（踩的坑）**

- **LF 行尾**：下发的 bash 脚本如果是 CRLF（Windows 换行），车端 Linux bash 报 `command not found`——`\r` 被当成命令一部分。强制 LF。
- **磁盘按车型解析**：不同车型车端磁盘挂载点不同，下发脚本里的路径要按车型解析，写死路径会在某些车型上写崩。
- **幽灵录制**：停止采集时如果"只改了云端的库状态、没真正通知车端停止"，车端还在录、云端以为停了——数据继续堆积。从此定红线：**无论停止车端成败，下发状态一律保持成功**——宁可状态撒谎说停了（后续人工核对），也不能出现"以为停了其实没停"的幽灵录制。这条红线是从事故里来的。
- **SSH 版没有看门狗**：干等 6 分钟超时才判失败；Kafka 版有 JobWatchdog 主动判 STALLED/超时，可重试。这是两套并存的核心动机——Kafka 版补了 SSH 版失联兜底的缺口。

**面试会怎么问**

- "两套为什么要灰度并存，不直接替换？" → SSH 版成熟但失联兜底弱；Kafka 版兜底强但链路长。灰度并存是在替换过程中保证稳定的过渡态，不是设计目标。
- "停止状态红线为什么宁可撒谎？" → 幽灵录制的代价（数据持续堆积、磁盘写满）大于"状态不准确"的代价。先保证不录，再人工核对状态。

**30 秒答法**

> 车云链路两套实现灰度并存：SSH 同步直连成熟但失联兜底弱（干等 6 分钟超时）；Kafka 异步长任务有状态机 + 看门狗主动判 STALLED 可重试。踩过 LF 行尾（CRLF 致 bash command not found）、磁盘按车型解析、幽灵录制的坑。停止流程有红线：无论停止车端成败下发状态一律保持成功，先保证不录再核对状态。

---

## 二、Python/FastAPI 全栈（挖掘平台）

### 6. 分布式锁：fence token + Lua CAS + watchdog

**是什么**

基于 Redis 的异步分布式锁，核心解决"持锁期间锁被别人抢走后旧持有者误操作"。代码注释里写死了**设计契约**（强制 Review 检查项）。

**为什么这么设计（踩的坑）**

锁最经典的坑是 **TTL 过期 → 别人抢走 → 旧持有者误删/误写**。每个机制都对应这个坑：

- **fence token**：抢锁时生成不可重复的 token（`进程标识 + uuid4 + 单调时钟`）。释放/续租时用这个 token 做 CAS——只有 token 还是自己才操作，防误删别人持有的锁。
- **Lua CAS release/renew**：释放和续租用 Lua 脚本在 Redis 端原子执行 `GET==token ? DEL/PEXPIRE`，避免"先 GET 再 DEL"之间的竞态。
- **watchdog 续租**：协程每 `ttl/3` 续租一次，`max_lifetime` 默认 5 分钟后主动放弃续租——防持锁协程卡死导致锁 indefinite 不释放。续租 CAS 失败（被人接管）标记 `is_lost=True`。
- **is_lost 写库前二次确认**：持锁期间写库前查 `lock.is_lost`，续租失败就不写——防"锁已丢但还在写"的脏写。
- **环境命名空间 + db 映射**：所有 key 改写为 `mp:{env}:lock:...`，配合 Redis db 的 env→db 强制映射，**两层防护**防 dev/prod 共集群时跨环境踩踏。
- **禁止回退无锁**：Redis 不可达统一抛 `LockUnavailableError`，**禁止**退化到无锁逻辑——宁可业务失败也不能无锁跑。

**面试会怎么问**

- "为什么不用 Redlock？" → Redlock 防的是"单点 Redis 故障导致锁丢失"，但本场景锁的威胁是"持锁者自己 TTL 过期后的误操作"，fence token + Lua CAS 更对症。而且 Redlock 对网络分区敏感，工程上单 Redis + 强 CAS + watchdog 更可控。
- "watchdog 续租间隔为什么是 ttl/3？" → 在"TTL 过期前续上"和"续租请求频率"之间取的——间隔大于 ttl/2 有过期风险，等于 ttl/3 给一次失败留重试余量。
- "Redis 挂了怎么办？" → 抛 LockUnavailableError，业务侧 API 转 503，worker 跳过本轮下轮兜底。绝不无锁跑——这是安全 vs 可用的明确取舍：选安全。

**30 秒答法**

> Redis 分布式锁，核心防"TTL 过期后旧持有者误操作"。抢锁生成 fence token（进程+uuid+单调时钟），释放和续租用 Lua CAS（GET==token 才 DEL/PEXPIRE）防误删别人的锁。watchdog 每 ttl/3 续租，5 分钟 max_lifetime 主动放弃，续租失败标 is_lost 让写库前二次确认。环境命名空间 + db 映射两层防护防 dev/prod 踩踏。Redis 不可达直接抛异常，禁止回退无锁——选安全不选可用。

---

### 7. 状态机/并发：批量任务状态机 + 重复入库拦截 + 并发限流

**是什么**

批量任务（batch_task）的生命周期状态机：`extracting → ready → running → success / partial_success / fail`，配套重复入库拦截和并发限流。

**为什么这么设计（踩的坑）**

- **重复入库拦截**：`ingest` 接口（入库）如果当前任务已是 `pending / running / success`，**拒绝重复触发**；只有 `init / fail` 才允许重新入库。坑是：前端重试、网络重发会让同一个任务被反复 ingest，没拦截就重复写库。
- **并发限流三参数**：`BATCH_MAX_RUNNING_JOBS`（最大并行任务数）、`BATCH_MAX_SUBTASKS_PER_ENQUEUE`（单次入队子任务数）、`BATCH_TASK_POLL_INTERVAL_SEC`（轮询间隔）。防 worker 把 DP（数据产线）打爆——产线是共享资源，不限流一个平台就把别人的额度吃光。
- **DP 状态简化再聚合**：批量任务总状态**先依据 DP 的简化状态**（running/success/fail）推进，再结合主/子任务聚合结果收敛到 `success/partial_success/fail`。不直接拿 DP 的细粒度状态映射，因为 DP 状态频繁抖动，简化后再聚合能吸收抖动。
- **空 sensor 短路**：创建时 `sensor_list` 为空，主任务直接标 success 不生成子任务——避免生成一堆空任务去跑产线。

**面试会怎么问**

- "partial_success 和 fail 怎么界定？" → 看子任务聚合：全部子任务成功→success；部分成功→partial_success；全失败→fail。partial 是允许的终态，因为一个 batch 里个别 clip-sensor 没数据不该让整批失败。
- "为什么总状态先看 DP 简化状态？" → DP 状态抖动，直接映射会让总状态反复横跳。先简化成三态再聚合，吸收抖动，总状态稳定。

**30 秒答法**

> 批量任务状态机 extracting→ready→running→success/partial_success/fail。ingest 接口拦截重复入库（pending/running/success 拒绝，init/fail 允许重试）。并发限流三个参数防打爆共享的 DP 产线。总状态先依据 DP 简化状态（running/success/fail）推进再聚合，吸收 DP 状态抖动。空 sensor 直接短路成功不生成子任务。

---

### 8. N+1 + Kafka：统一名称映射 + Producer 配置维度缓存

**是什么**

两个点：

- **`resolve_id_name_map` 统一批量映射**：列表/详情接口里把外键 `*_id` 转 `*_name`，统一走一个批量映射工具，避免每个模块各写一份、避免列表场景 N+1。
- **Kafka Producer 配置维度缓存**：发消息时按"配置维度"（bootstrap_servers + username + password）缓存 Producer 实例，同配置复用、失败移除。

**为什么这么设计（踩的坑）**

- **N+1 的来源**：跨模块详情返回名称化（experiment/inference/mining/batch_task 的 `demand_id/workflow_id/dataset_id` 都要转 name），最早每个模块各写一套 id→name 查询，列表场景下每行查一次就是 N+1。统一收敛到 `resolve_id_name_map`，批量 IN 一次取回所有 name，Map 索引装配。
- **Producer 为什么要配置维度缓存**：Kafka Producer 初始化重（建连接、元数据拉取）。如果不缓存，每次发消息新建 Producer，开销大；如果全局单例，又没法支持"调用方在请求体里传不同配置"（工程内不维护 Kafka 配置，全由调用方传入）。折中是按配置维度缓存——同配置复用，不同配置各自建，发送失败时移除该配置的 Producer（防坏连接复用）。
- **工程内不维护 Kafka 配置**：配置全由调用方请求体传入。这是有意为之——不把基础设施配置耦合进应用，调用方对自己传的配置负责。

**面试会怎么问**

- "Producer 缓存的 key 怎么设计？" → 配置元组（bootstrap_servers + username + password）。不能只用 bootstrap_servers，因为同一集群可能不同认证。
- "为什么失败要移除 Producer？" → 复用一个坏连接的 Producer 后续都失败。移除后下次请求重建，自愈。

**30 秒答法**

> 列表/详情的 id→name 名称化统一走 resolve_id_name_map 批量映射，防列表 N+1，替换了各模块重复实现。Kafka Producer 按配置维度（servers+user+pwd）缓存复用避免重复初始化，同配置复用、发送失败移除该 Producer 自愈。工程内不维护 Kafka 配置，全由调用方请求体传入。

---

### 9. 抽样：蓄水池 + 按比例 + 零文件下载内存抽样

**是什么**

实验审核（review）对推理成功的子任务做抽样，避免全量审核。支持蓄水池抽样和按比例抽样。

**为什么这么设计（踩的坑）**

- **零文件下载内存抽样**：最朴素的实现是——发起审核时实时从 BOS 下载 JSON 结果文件、解析、抽样。但大文件下载耗内存、慢。改成：子任务 success 时**后台预解析**（worker 异步下载 JSON、提前解析出标签和图片明细 `items` 存到子任务的 `label_stats_json` 字段），审核抽样时直接用内存里已解析好的 `label_stats_json`，不再实时下载 BOS 文件——毫秒级抽样。
- **蓄水池 vs 按比例**：蓄水池抽样（reservoir）用于"固定抽 N 个"；按比例用于"抽 x%"。`sampling_rules` 配置规则，`sample_seed` 保证可复现（同样的 seed 抽出同样的样本，便于复核）。
- **主任务多口径统计**：抽样后不只统计各标签总出现次数，还统计各标签**被实际抽中的数量**（`sampled_count`），汇总到主任务——这样审核人能看到"这个标签总量多少、实际抽了多少、占比多少"，而不是只有总量。

**面试会怎么问**

- "为什么用 sample_seed？" → 可复现。审核结果被质疑时，用同样的 seed 能重放出同样的样本，证明抽样没作弊。
- "预解析为什么要后台异步？" → 抽样是用户触发的前端操作，要快。如果采样时才下载解析，用户等几秒；预解析把耗时挪到子任务 success 后台，抽样时只是读内存。

**30 秒答法**

> 审核抽样支持蓄水池和按比例，sample_seed 保证可复现。关键是零文件下载内存抽样：子任务 success 时后台预解析 JSON 存 label_stats_json，抽样时直接用内存数据不实时下载 BOS，毫秒级。主任务统计各标签总量和实际抽中数 sampled_count，让审核人看到抽样占比。

---

### 10. 数据流转/存储：BOS↔PFS + 预签名 + ES 聚合统计

**是什么**

三块数据流转与查询能力：

- **BOS↔PFS 数据流转**：通过 PFS 数据流动 OpenAPI 实现对象存储（BOS）与并行文件系统（PFS）之间的导入导出。
- **BOS 预签名 URL + 图片格式白名单**：前端直传用预签名 URL，限制只允许 jpg/jpeg/webp。
- **ES agg + cardinality 统计**：挖掘规则的 clip 命中统计。

**为什么这么设计（踩的坑）**

- **BOS↔PFS 走 OpenAPI 而非自己搬**：大文件在 BOS 和 PFS 间搬，自己写脚本拉下来再传上去既慢又占带宽。用 PFS 的 `CreateL2BucketLink`（L2 链路）做服务端搬移，`transferType=0` 是 PFS→BOS 导出、`1` 是 BOS→PFS 导入，走的是 BCE Auth v1 签名。自己只负责"创建链路 + 轮询状态 + 等完成"。
- **预签名 URL + 格式白名单**：前端直传不经后端转发（省带宽），但后端签发预签名时要校验后缀——只签 jpg/jpeg/webp，不签就等于让人往桶里传任意文件。
- **ES 聚合统计的口径坑**：挖掘规则有两个统计列——`executed_clip_count`（该规则所有 batch_task 在 sam3_msg_record 上的去重 clip_id 数，跨 batch_task 也去重）和 `tagged_clip_count`（ES `data_frame_*` 索引里 `tags.*.value` 含该规则名的近似去重 clip_id 数）。注意 `rule_name` 和 workflow 的 `model_version` 不是一回事——前者是真正写到 ES 标签的版本字符串，后者是 workflow 语义版本。混了就统计错。
- **冷热路径分离**：冷路径（实时聚合 OB + ES）< 1.5s，热路径走 Redis 5s TTL 缓存毫秒级返回。ES 查询用 `agg + cardinality + lenient:true`，`lenient:true` 容忍字段类型不匹配的文档不报错。

**面试会怎么问**

- "为什么预签名要限格式？" → 不限等于开放桶写入任意文件类型，有安全和成本风险（传大文件占存储）。白名单在签发环节拦，比上传后清理省事。
- "rule_name 和 model_version 为什么要区分？" → 一个是写到 ES 标签的真实版本，一个是 workflow 的语义版本。统计用错就会把不同版本的命中数算到一起。

**30 秒答法**

> BOS↔PFS 用 PFS 数据流动 OpenAPI（L2BucketLink，BCE Auth v1 签名）做服务端搬移，不自己拉传。预签名 URL 给前端直传 + jpg/jpeg/webp 白名单在签发环节拦。挖掘规则统计走 ES agg + cardinality + lenient:true，冷路径 < 1.5s 热路径 Redis 5s TTL。关键是 rule_name 和 model_version 不是一回事，统计要分清。

---

### 11. 版本锁定/踩坑：pymysql 版本上界 + 异常日志防吞错

**是什么**

两个"小但关键"的工程治理：

- **`pymysql<1.2.0` 版本上界锁定**：避开 SQLAlchemy aiomysql 适配器的 `ping()` 签名破坏。
- **异常日志规范化防静默吞错**：核心运行链路补齐广义异常捕获的错误记录。

**为什么这么设计（踩的坑）**

- **pymysql 1.2.0 破坏了什么**：SQLAlchemy 的 aiomysql 适配器依赖 pymysql 的 `ping()` 签名，pymysql 1.2.0 改了这个签名，导致适配器报错（SQLAlchemy issue #13306）。所以锁定 `pymysql>=1.1.0,<1.2.0`——既拿到 1.1 的修复，又避开 1.2 的破坏。**这是传递依赖破坏的典型**，不是自己代码的 bug，是依赖的依赖升版本炸了适配层。
- **静默吞错**：早期代码里多处 `except Exception: pass` 或 `except Exception: return None`——异常被吃了，排障时啥日志都没有。治理是在这些位置补上 `logger.error(...含堆栈)` 再回退/返回。坑的核心：**异常被吞 ≠ 系统正常**，线上看着没报错其实一直在失败，等发现时已经堆积很久。
- **ES silent-failure 路径**：ES 查询有"静默失败"的路径——查询语法/类型问题导致部分文档不参与聚合但不报错，结果数对不上。复用老 `es_export` 已修复的这条路径，确保新统计不走 silent-failure。

**面试会怎么问**

- "为什么要锁 pymysql 上界？" → 它 1.2.0 改了 ping() 签名，炸了 SQLAlchemy 的 aiomysql 适配器（issue #13306）。这是传递依赖破坏，自己代码没 bug，是依赖图里的兼容性问题。
- "静默吞错怎么发现？" → 看监控看不出（没错误日志），看业务现象才发现（结果数不对、任务卡住）。所以治理是给所有广义 except 补日志。

**30 秒答法**

> pymysql 锁 `<1.2.0` 因为 1.2.0 改了 ping() 签名炸了 SQLAlchemy aiomysql 适配器（issue #13306）——传递依赖破坏。异常日志规范化是把核心链路里的 `except Exception` 静默吞错全补上含堆栈的 logger.error 再回退——异常被吞不等于系统正常，线上没报错其实一直在失败。

---

## 三、同构对照：同样的问题，两套技术栈怎么解

这张表是复习的捷径——同一个工程问题在 Java 栈和 Python 栈里各自怎么解，记住"问题模式"比记两遍细节省力。

| 工程问题 | Java/Spring 栈（车云链路） | Python/FastAPI 栈（挖掘平台） | 共同本质 |
|---|---|---|---|
| **N+1 防御** | JPA 零关联注解 + collect id→批量 IN→Map 索引 | `resolve_id_name_map` 统一批量映射 | 都是"先 collect id，再批量查，再 Map 装配"，区别只在 ORM 层 |
| **状态机 + 兜底** | JobState 九状态四终态 + JobWatchdog 扫超时 | 批量任务状态机 + DP 状态简化再聚合 | 都用"可恢复态 vs 终态"区分，都有超时兜底 |
| **异步失联兜底** | SSH 版干等 6 分钟 → Kafka 版 STALLED 可重试 | watchdog 每 ttl/3 续租 + is_lost 二次确认 | 都是"不干等，主动判活，失败可恢复" |
| **分布式协调** | Redisson 锁按"车辆+批次"防并发归因 | Redis 分布式锁 fence token + Lua CAS | 都用 Redis 锁，Python 栈多做了 fence token 防 TTL 误删 |
| **manifest 指针** | 下发用 manifest 指针模式（不传全量数据） | 批量任务 `result_manifest.json` 异步汇总 | 都是"不传/不实时遍历全量，用指针指向汇总结果" |
| **写侧失败处理** | 共库直读写侧失败只告警不抛 | Redis 不可达抛异常禁止回退无锁 | 取向不同：一个"告警继续"，一个"直接失败"——取决于失败代价 |

**记忆要点**：面试时遇到任何一边的题，先想"这是哪个共同本质"，再套到具体技术栈的解法。比硬背 11 个点轻松。

---

## 四、怎么用这份文档自查

1. **先看"是什么"**——如果某个点的概念你用自己的话讲不出来，这个点在面试是负债，要么学懂要么从简历删。
2. **再看"为什么这么设计"**——这是面试官真正在问的。能讲清"踩了什么坑所以这么设计"，比背概念值钱十倍。
3. **"面试会怎么问"**是预判追问方向，对着自查"这个追问我答得上吗"。
4. **"30 秒答法"**背到能脱口而出，但只在你确认前三步都懂的前提下背——不懂只背 30 秒答法，一追问就穿。

守诚实边界：真做过的讲"我做过/我修过"；读过没动手的讲"我读过这块、团队当时这么判断"；设计提案讲"如果做我会这么设计"。标注边界本身就是"兜得住"的证据。
