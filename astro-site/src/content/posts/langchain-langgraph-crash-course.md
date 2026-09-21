---
title: "LangChain/LangGraph 速成：后端工程师转 Agent 开发的七天路线与面试 20 问"
published: 2026-09-21
description: "没在生产用过 LangChain/LangGraph 也能补齐 Agent 岗位：先看你已有经验与框架概念的映射表，再走七天速成路线，最后是 20 道高频面试题（一句话答案+展开+陷阱），附诚实话术。"
tags: ["面试", "Agent", "LangChain", "LangGraph", "Python"]
category: "AI"
draft: false
---

> 背景：现在很多 Python 岗位要求 Agent 开发经验（LangChain、LangGraph），但我生产上没这两个框架——我自己写过任务编排、状态机、人工审核流。**结论先行：这不是从零开始，而是「补框架名词 + 把手写过的机制对上号」。**本文给出概念映射表、七天速成路线、最小代码集和面试 20 问。

---

## 第一部分：你不是从零开始——概念映射表

LangGraph 的官方定位是「low-level orchestration framework for stateful agents」，它的核心卖点恰好都是后端工程师的手艺：

| 你手写过的东西 | 框架里的对应概念 | 说明 |
|---|---|---|
| 任务状态机（running/done/stuck + 看门狗） | **StateGraph**：节点 + 边 + 条件转移 | LangGraph 本质就是一个图状态机，状态显式建模 |
| 任务表存进度、崩溃后接着跑 | **Checkpointer**：每步落盘，断点续跑 | `thread_id` 定位一次会话，宕机恢复从最近 checkpoint 继续 |
| 人工审核后才能变生产规则 | **Human-in-the-loop**：`interrupt()` 挂起等批准 | 图执行到一半暂停，人批完 `Command(resume=...)` 继续 |
| 提交推理任务→轮询/回调收结果 | **Tool calling 循环**：模型要工具→执行→结果回填 | 你的「三路结果解析」对应工具结果的容错处理 |
| 幂等写兜底锁失效 | **节点重试 + 幂等工具设计** | 框架 at-least-once 执行节点，工具照样要幂等 |
| 环境隔离、配置注入 | **Runnable 配置体系**：config 逐层透传 | 模型、超时、回调都走 config，不散落全局 |
| 拼接 prompt 模板 | **PromptTemplate / ChatPromptTemplate** | 变量插值 + 版本管理 |
| 结构化解析模型输出（三分支） | **Output Parser / structured output** | schema 校验 + 解析失败重试 |

**面试策略由此而定**：不说「我没用过」，说「这些机制我在生产里都手写过，框架把它们标准化了——我学框架是在学 API，不是在学概念」。这是真话，而且比背 API 的候选人更有区分度。

---

## 第二部分：七天速成路线

### 资源清单（按优先级）

1. **[LangChain Academy](https://academy.langchain.com/)（官方免费课程，首选）**
   - [Introduction to LangGraph](https://academy.langchain.com/courses/intro-to-langgraph)：State / Node / Edge / Memory / HITL 全套，有配套 notebook
   - [Deep Research with LangGraph](https://academy.langchain.com/courses/deep-research-with-langgraph)：项目课，多步研究型 agent
   - [Ambient Agents](https://academy.langchain.com/courses/ambient-agents)：28 课 2.5 小时，含 Agent 评估与部署
   - 课程代码仓库：[langchain-ai/langchain-academy](https://github.com/langchain-ai/langchain-academy)
2. **[官方统一文档 docs.langchain.com](https://docs.langchain.com/oss/python/releases/changelog)**：LangChain 与 LangGraph 1.0 后合并到一个站，Python/JS 双示例
3. **[LangChain 1.0 / LangGraph 1.0 发布博客](https://www.langchain.com/blog/langchain-langgraph-1dot0)**：了解 1.0 的 API 取向（`create_agent`、稳定核心），避免学到被废弃的旧写法
4. **[JetBrains 的 LangChain 2026 教程](https://blog.jetbrains.com/pycharm/2026/02/langchain-tutorial-2026/)**：IDE 视角的完整上手
5. 社区课：[10 Days of LangChain 2026](https://github.com/sebuzdugan/langchain-course-2026)（hands-on，从核心 agent 逻辑到 Streamlit 应用）

⚠️ **版本陷阱**：网上大量教程是 LangChain 0.1/0.2 时代的（LLCEL 链、`initialize_agent`、AgentExecutor）——**1.0 后 agent 的推荐写法是 `create_agent`（底层就是 LangGraph）**，学的时候认准 docs.langchain.com 的当前版本，别照着两年前的博客抄。

### 七天安排

**Day 1-2：LangChain 基础件**（每样跑通一个最小例子）
- Chat Model 接入（OpenAI 兼容接口即可，用你熟悉的任意模型服务）
- PromptTemplate / ChatPromptTemplate
- Output Parser 与 `with_structured_output`（schema 校验）
- `@tool` 装饰器定义工具 + 模型绑定工具（`bind_tools`）

**Day 3-4：LangGraph 核心**（重头戏，对应你手写过的状态机）
- `StateGraph`：State 定义（TypedDict + reducer）、add_node / add_edge / add_conditional_edges
- agent 循环图：agent 节点 ⇄ tools 节点，条件边判断「还要不要继续调工具」
- **Checkpointer**：MemorySaver 起步，看 SqliteSaver/PostgresSaver 的接口——对照你的任务表
- **interrupt / Command**：人工审批节点——对照你的审核流

**Day 5-6：做一个完整小项目（面试的「我用它做过 X」）**
推荐题目：**复刻你自己的业务**——「数据挖掘任务 agent」：用户提需求 → agent 调工具做实验（mock 推理接口）→ `interrupt` 人工审核 → 审核通过后写入「生产规则」。
这个项目的好处：每一层你都能讲出「为什么这么设计」，因为生产版你写过。顺手加上：
- 短期记忆（checkpointer 按 thread_id）+ 长期记忆（Store 存用户偏好）
- 流式输出（`stream_mode="messages"`）
- 一个多 agent 变体：supervisor 路由到两个子 agent

**Day 7：工程化外围**
- **LangSmith**：trace 每一步的输入输出（可观测性，对照你给任务链路加的日志/指标）
- 评估：golden set + LLM-as-judge 跑一遍你的 agent
- 部署形态了解即可：`langgraph-cli` 本地起服务、LangGraph Platform 的概念（托管部署、任务队列、cron）

---

## 第三部分：最小代码集（背这四个就够了）

### ① 最简单的 agent（LangChain 1.x）

```python
from langchain.agents import create_agent

def get_weather(city: str) -> str:
    """查询城市天气"""          # docstring 就是给模型看的工具描述
    return f"{city}: 晴, 25°C"

agent = create_agent(
    model="openai:gpt-4o",      # 或任意 OpenAI 兼容端点
    tools=[get_weather],
)
result = agent.invoke({"messages": [{"role": "user", "content": "北京天气如何？"}]})
```

`create_agent` 底层就是一个预制的 LangGraph 图：agent 节点 ⇄ tools 节点 + 条件边。理解这一点，两个框架就打通了。

### ② 手写 StateGraph（理解 agent 循环的本质）

```python
from typing import Annotated, TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

class State(TypedDict):
    messages: Annotated[list, add_messages]   # reducer: 新消息追加而非覆盖

def agent_node(state: State):
    return {"messages": [model_with_tools.invoke(state["messages"])]}

def tools_node(state: State):
    last = state["messages"][-1]
    results = [tool.invoke(tc) for tc in last.tool_calls]
    return {"messages": results}

def should_continue(state: State):
    return "tools" if state["messages"][-1].tool_calls else END

g = StateGraph(State)
g.add_node("agent", agent_node)
g.add_node("tools", tools_node)
g.add_edge(START, "agent")
g.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
g.add_edge("tools", "agent")          # 工具结果回到 agent → 循环
app = g.compile()
```

### ③ 持久化 + 人工审批（对照你的任务表 + 审核流）

```python
from langgraph.checkpoint.memory import MemorySaver   # 生产换 PostgresSaver
from langgraph.types import interrupt, Command

def review_node(state: State):
    decision = interrupt({"question": "批准这条规则进入生产吗？",
                          "rule": state["draft_rule"]})   # 图在此挂起并落盘
    return {"approved": decision["approved"]}

app = g.compile(checkpointer=MemorySaver())
cfg = {"configurable": {"thread_id": "task-42"}}         # thread_id = 你的任务 ID
app.invoke(inputs, cfg)          # 跑到 interrupt 停住
# ...几小时后，人点了批准...
app.invoke(Command(resume={"approved": True}), cfg)      # 从断点继续
```

### ④ 流式输出

```python
for chunk in app.stream(inputs, cfg, stream_mode="messages"):
    print(chunk)   # token 级流式；还有 values/updates 模式看状态快照
```

---

## 第四部分：面试 20 问

### 框架认知

**Q1. LangChain 和 LangGraph 什么关系？各解决什么问题？**

一句话：LangChain 提供组件（模型接入、prompt、工具、输出解析）和开箱即用的 agent；LangGraph 是底层的**图编排引擎**，把 agent 建模为显式状态机——需要精细控制（循环、分支、挂起、断点）时用它。

展开：LangChain 1.0 的 `create_agent` 底层就是用 LangGraph 实现的——所以关系是「高层 API 站在低层引擎上」。简单任务 `create_agent` 一行搞定；复杂流程（多 agent、人工审批、条件回退）手写 StateGraph。

陷阱：别说「LangChain 做 agent，LangGraph 做多 agent」——LangGraph 也能做单 agent（它就是标准实现），区别在**控制粒度**，不在 agent 数量。

**Q2. LCEL 是什么？现在还重要吗？**

一句话：LangChain Expression Language，用 `|` 管道符把组件串成 Runnable 链（`prompt | model | parser`）。

展开：核心抽象是 **Runnable 协议**（invoke/stream/batch + config 透传），1.0 后依然是一切组件的底层接口；但「用 LCEL 手拼 agent 循环」的旧写法已被 `create_agent`/LangGraph 取代。面试提到 LCEL 时讲清 Runnable 协议的价值（统一接口、可组合、流式贯通）即可。

**Q3. 为什么用框架而不是自己裸写 OpenAI SDK？（高频拷打题）**

一句话：裸写当然能跑——框架的价值在于把**状态持久化、断点续跑、人工挂起、流式、多 agent 路由、可观测**这些生产必需品标准化了，自己写等于重新发明 LangGraph。

展开（用你的经历答，最有说服力）：我手写过任务编排系统，状态机、看门狗、幂等兜底、结果三路解析都是自己实现的——功能上和 LangGraph 的 checkpointer、interrupt、重试机制一一对应。手写让我理解了每个机制**为什么存在**；框架的意义是这些坑别人已经踩平了，新项目的正确选择是用框架，把精力留给业务。

陷阱：这题在钓「你会不会盲目上框架」。答案要体现权衡：原型/极简场景裸 SDK 更轻；一旦需要持久化状态和人工介入，框架的账就算得过来了。

### LangGraph 核心机制

**Q4. StateGraph 的 State 是什么？reducer 解决什么问题？**

一句话：State 是一个 TypedDict，节点接收它、返回**部分更新**；reducer（如 `add_messages`）定义更新怎么合并——默认是覆盖，消息列表需要追加语义所以用 reducer。

展开：节点是纯函数 `(state) -> partial_state`，框架负责合并。`Annotated[list, add_messages]` 表示新消息按 ID 追加/去重合并而非整表替换。这个设计让节点天然可测试、可并行（并行节点的更新靠 reducer 合并，冲突要自己设计 reducer 处理）。

**Q5. Checkpointer 是什么？和生产数据库什么关系？**

一句话：每个超步（节点执行完）后把完整 State 快照持久化，按 `thread_id` 组织——它是断点续跑、时间旅行（回滚到某步重放）、人工挂起的基础设施。

展开：开发用 MemorySaver，生产用 PostgresSaver/SqliteSaver。`thread_id` 对应一次会话/任务（等于我原来任务表里的主键）。对照关系：checkpoint 表 ≈ 我手写的任务进度表，只是框架把它做成了通用协议。

追问「checkpoint 会不会太大」：State 里别放大对象（文件内容、大 JSON），放引用（key/URL），和「数据库存指针不存 blob」一个道理。

**Q6. interrupt() 的工作原理？为什么它能挂起几小时再恢复？**

一句话：`interrupt()` 在节点内抛出特殊异常，框架把当前 State 落到 checkpointer 后结束本次 invoke；恢复时用 `Command(resume=值)` 重新进入，**从头重放该节点**、interrupt 处直接返回 resume 值。

展开：能挂起任意久是因为状态在外部存储里，进程不需要活着。注意「重放节点」意味着 interrupt 之前的代码会再执行一次——**节点内 interrupt 之前不要放有副作用的操作**（写库、发请求），副作用放到 interrupt 之后的独立节点。这是我踩过的坑的框架版：和我手写审核流时「审核前后的动作要分事务」是同一个问题。

**Q7. 条件边和普通边的区别？agent 循环怎么表达？**

一句话：普通边是固定转移；条件边 `add_conditional_edges(node, 路由函数, 映射)` 根据 State 动态选下一跳。agent 循环 = agent 节点后接条件边：有 tool_calls 去 tools 节点，没有就 END；tools 节点固定边回 agent。

展开：这就是「模型决策 → 执行 → 结果回填 → 再决策」的图表达。循环的终止条件除了「模型不再调工具」，生产上还要加**步数上限**（recursion_limit，默认 25）防死循环——和我给轮询任务加超时看门狗一个道理。

**Q8. LangGraph 怎么做并行？**

一句话：一个节点连出多条边到多个节点，它们在同一个超步并行执行，各自返回的部分 State 由 reducer 合并。

展开：典型场景是 map-reduce（一份文档拆 N 段并行摘要再汇总）和多工具并行调用。要注意合并冲突：两个并行节点写同一个 key，reducer 必须能处理（列表追加天然安全，覆盖语义就是竞态）。

### Agent 工程

**Q9. Agent 的记忆分几种？各自怎么实现？**

一句话：短期记忆 = 当前 thread 的消息历史（checkpointer 存）；长期记忆 = 跨 thread 的用户偏好/事实（Store 存，namespace 按用户隔离）。

展开：短期记忆会膨胀，工程手段：消息裁剪（保最近 N 条）、摘要压缩（老消息滚动总结）、重要信息外提（存 Store）。长期记忆写入要克制——模型自己判断「值得记」再写，否则 Store 变垃圾场。对照：这就是我在《Agent 与 RAG 工程 22 问》里讲的记忆打分/衰减那套的框架实现。

**Q10. 多 Agent 架构有哪几种模式？什么时候用？**

一句话：supervisor（中心路由，一个协调者分派给专家 agent）、swarm/handoff（agent 之间平级移交控制权）、层级（supervisor 的 supervisor）。**能用单 agent + 多工具解决的不要上多 agent**。

展开：多 agent 的真实动机是**上下文隔离**——一个 agent 塞 30 个工具时选择准确率下降，拆成「每个子 agent 5-8 个工具 + supervisor 路由」各自上下文干净。代价：延迟（多跳）、成本（多份 token）、调试难度（要看 trace）。LangGraph 里 supervisor 就是一个条件边路由节点，handoff 用 Command(goto=...) 实现。

**Q11. 怎么防止 agent 死循环 / 失控？**

一句话：三层——`recursion_limit` 步数硬上限；工具级预算（调用次数/花费限额，在工具实现里数）；关键动作 interrupt 人工把关。

展开：死循环常见原因是工具一直报错、模型反复重试同一个失败调用——所以工具失败信息要**可行动**（告诉模型「参数 X 不合法，可选值是...」而不是裸 500）。这和后端「错误响应要给客户端足够信息走下一步」是同一原则。

**Q12. 流式输出有哪几种模式？为什么 agent 应用必须做流式？**

一句话：`stream_mode` 有 values（每步完整 State）、updates（每步增量）、messages（token 级）；agent 任务动辄几十秒，不流式用户以为挂了。

展开：中间步骤（正在调哪个工具）用 updates 做进度提示，最终回答用 messages 做打字机效果。框架把「节点级流」和「token 级流」统一在一个 stream 接口里，这是裸写 SDK 要自己拼的部分。

**Q13. Agent 怎么评估？LangSmith 是干什么的？**

一句话：LangSmith 是 trace + 评估平台——记录每一步的输入输出/耗时/token，在其上建 golden set 做回归评估。评估方法同 LLM 应用通法：组件层（工具选择准确率、单步正确率）+ 端到端（任务完成率，LLM-as-judge + 人工抽检）。

展开：agent 评估比普通 LLM 应用难在**路径不唯一**——同一任务可以走不同工具序列，所以端到端看「结果对不对」，trace 层看「有没有绕路/多余步骤/重复失败」。上线前跑评估集防止 prompt/模型升级回归，和后端 CI 跑单测是一个纪律。

**Q14. MCP 和 LangChain 什么关系？**

一句话：MCP 是工具接入的标准协议，LangChain 1.x 内置了 `langchain.mcp` 适配器（基于 FastMCP）——MCP server 提供的工具可以直接加载进 create_agent/LangGraph 用。

展开：分工是「MCP 管工具的发现和传输，框架管 agent 循环」；接入第三方 MCP server 要审查其权限面（它能读什么、能调什么），生产上按需白名单。

**Q15. RAG 在 LangChain 生态里怎么做？**

一句话：检索侧自由组合（任意向量库的 VectorStore 接口 + retriever），生成侧两种形态：简单场景 retrieval 塞 prompt 一次生成；agent 场景把检索做成一个 tool，让模型自己决定查什么、查几次（agentic RAG）。

展开：agentic RAG 的优势是**多跳**——第一次检索结果不够时模型会改写查询再查；代价是延迟和 token。链路上每一环的失败模式（切块、混合检索、rerank）见[《Agent 与 RAG 工程 22 问》](/posts/agent-rag-engineering-22q)。

### 生产与陷阱

**Q16. LangGraph 应用怎么部署？**

一句话：本质是个 Python 应用——容器化后用 langgraph-cli 起 dev server 验证，生产可以自托管（图 + PostgresSaver 自己的库）或用 LangGraph Platform（托管：任务队列、cron、水平扩容、双写持久化）。

展开：自托管要注意的点全是后端老问题：checkpoint 库的容量与清理、长任务的 worker 超时配置、并发 thread 的隔离。选 Platform 还是自托管是「买 vs 建」的常规权衡。

**Q17. 这两个框架有什么坑 / 你踩过什么坑？**

一句话：三大坑——API 版本剧烈变动（0.x 教程满天飞，学错写法）、抽象层过深导致调试困难（出错栈十几层框架代码）、默认行为想当然（recursion_limit、checkpoint 膨胀）。

展开：对策分别是认准官方当前文档 + 锁版本；用 LangSmith trace 代替裸 print 调试；State 里只放引用不放 blob。能主动讲坑的候选人比只会背优点的可信得多。

**Q18. 什么情况下你不该用 LangGraph？**

一句话：一次性脚本、单轮问答、纯 workflow（步骤完全固定无模型决策）——用裸 SDK + 普通代码更简单可控。

展开：判断标准是「**路径是否由模型动态决定**」：固定流水线用普通函数编排（甚至 Airflow 类工具），模型要自己决定下一步才需要 agent 图。框架不是目的，别为了简历写代码。

**Q19. 你没在生产用过 LangGraph，怎么证明你能上手？（诚实题，必然被问）**

一句话：直说没在生产用过，但立刻给出三层证据：机制映射（状态机/checkpoint/HITL 我都手写过对应物）、七天路线产出的完整 demo（能讲每个设计决策）、以及「学框架对我是学 API 不是学概念」的判断。

展开（话术模板）：

> 「LangGraph 我没在生产环境用过，这点我不掩饰。但我上一个平台里，任务状态机、断点续跑、人工审核挂起、幂等兜底都是我自己设计实现的——和 LangGraph 的 StateGraph、checkpointer、interrupt 是同一套问题的两种写法。我用 LangGraph 复刻过那个审核流（demo 可讲），最大的感受是框架把我当时踩过的坑都做成了协议。给我一个新 agent 项目，我的上手成本在 API 熟练度，不在概念。」

**Q20. 你怎么看 Agent 框架的未来 / 技术选型趋势？**

一句话：趋势是「协议标准化 + 编排轻量化」——工具接入收敛到 MCP，模型侧能力增强（内置推理）让薄编排更可行；框架竞争点在持久化、可观测和部署这些**工程配套**，而不是 prompt 花活。

展开：选型上我的判断标准：团队已有 Python 后端栈 → LangGraph 生态成熟；重多 agent 会话 → 看 AutoGen/CrewAI 的取舍；极简可控 → 裸 SDK + 自己的状态机（我走过这条路，知道代价）。这题没有标准答案，展示判断框架即可。

---

## 附：七天产出 checklist

- [ ] LangChain Academy《Introduction to LangGraph》过完 + notebook 跑通
- [ ] 四个最小代码（create_agent / StateGraph / interrupt+checkpointer / stream）默写级熟练
- [ ] 一个完整 demo：带工具调用、持久化、人工审批、流式的 agent（推荐复刻自己的业务）
- [ ] LangSmith 接上，能看 trace
- [ ] 20 问每题练到「一句话接住 → 展开 → 陷阱」
- [ ] Q19 诚实话术练到不心虚——这是全场最重要的一题

> 相关阅读：[《简历答辩手册》](/posts/resume-interview-defense)（项目纵深）· [《Agent 与 RAG 工程 22 问》](/posts/agent-rag-engineering-22q)（LLM 工程纵深）· [《八股文手册》](/posts/interview-fundamentals-design-python-agent)（通用横向）
