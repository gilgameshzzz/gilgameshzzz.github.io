---
title: "微前端实战：宿主与子应用是怎么联动的（qiankun 为例）"
published: 2026-09-21
description: "从一个真实平台的微前端改造讲起：路由挂载、运行时注册中心、同源代理、跨应用通信四层接线，以及子应用如何做到既能被宿主嵌入、又能独立开发调试。内容已脱敏。"
tags: ["前端", "微前端", "qiankun", "架构"]
category: "前端"
draft: false
---

> 背景：我所在的平台前端是一个多年演进的单体大前端（下称「宿主」），新业务模块（数据平台）拆成了独立子应用。两边基于 UmiJS Max + qiankun 联动。本文把这层「接线」讲透——面试被问「你们前端什么架构」时，这比背 qiankun 原理更有说服力。内容已脱敏。

## 整体结构

```
宿主（qiankun master）
   ├── config/routes.ts        通配路由 /data/* → microApp: 'data-app'
   ├── src/microApp/registry   运行时注册中心：子应用 entry 从哪来
   └── qiankun.master 配置      prefetch / defaultLoader / ErrorBoundary
                 │  加载子应用静态资源并挂载
                 ▼
子应用（qiankun slave）
   ├── config.ts               qiankun: { slave: {} }
   ├── src/app.tsx             导出 qiankun 生命周期 + 消费宿主状态
   └── 独立启动模式             自己拉全局状态，可脱离宿主开发
```

联动分四层，逐层看。

## 第一层：路由挂载

宿主的路由表里只有一条声明：

```ts
{
  path: '/data/*',            // 通配：/data 下所有路由都交给子应用
  name: 'data',
  microApp: 'data-app',       // UmiJS qiankun 插件的挂载语法
  customProp: {
    microAppPermissionKeys: [ // 随挂载 props 下发的权限点
      'dataPlatform:dataCollect',
      'dataPlatform:tagSearch',
      // ...
    ],
  },
}
```

用户访问 `/data/**` 时，宿主不再渲染自己的页面组件，而是把一块 DOM 容器交给子应用挂载。两个细节：

- **通配路由是迁移的关键**。老平台的一级菜单是逐个迁移到子应用的，迁移期间宿主路由表里「已迁走的菜单」只剩一条通配挂载路由，其余菜单照常渲染——灰度、回滚都以路由为单位；
- **`customProp` 承担权限下发**。菜单级权限在宿主算好（宿主负责登录和权限体系），子应用页面组件只消费权限点，不重复实现鉴权逻辑。

## 第二层：运行时注册中心——子应用地址从哪来

子应用的 entry **不写死在构建产物里**，加载优先级是：

```
window.__MICRO_APP_REGISTRY__     ← K8s 环境变量 → 容器 start.sh 生成 config.js 注入
  > 构建时环境变量 XXX_DATA_APP_ENTRY
  > 默认同源路径 /micro-apps/data-app/
```

```ts
export function getMicroApps(): MicroAppConfig[] {
  if (typeof window === 'undefined') return DEFAULT_APPS;
  const runtime = window.__MICRO_APP_REGISTRY__;
  if (Array.isArray(runtime) && runtime.length > 0) {
    return runtime.filter((app) => app?.name && app?.entry);
  }
  return DEFAULT_APPS;
}
```

这是为了**一份镜像跑多环境**：测试/预发/生产只改 Deployment 的环境变量，宿主不需要为每个环境重新构建。这是微前端部署里最容易被忽略、也最值得在面试里主动讲的一点——静态配置注入让「环境差异」从构建期挪到了运行期。

## 第三层：同源代理——浏览器永远只访问宿主域名

子应用的真实域名不对外暴露，浏览器侧统一走同源相对路径：

```
浏览器 → https://宿主域名/micro-apps/data-app/  (同源，无跨域)
              │
              ├── 生产：nginx location 转发到子应用服务
              └── 开发：dev-server proxy 转发到子应用 dev server（带 pathRewrite）
```

```ts
// 宿主 config/proxy.ts（开发环境）
'/micro-apps/data-app/': {
  target: 'http://localhost:8001',   // 子应用本地 dev server
  changeOrigin: true,
  pathRewrite: { '^/micro-apps/data-app': '' },
},
```

三个收益一次拿到：

1. **跨域消失**——qiankun 用 fetch 拉子应用 HTML/JS，同源意味着不需要在子应用配 CORS；
2. **子应用域名可以收紧**——公网访问被限制在内网/白名单，浏览器只认宿主域名；
3. **本地联调极简单**——起两个 dev server 就能全链路调试，代理规则和线上 nginx 语义一致。

另外一个实战坑：**开发环境要关沙箱**。qiankun 的 window 代理会干扰子应用的 HMR WebSocket，我们的处理是开发环境关闭沙箱（`sandbox: false`），生产保持开启——样式和全局变量的隔离靠下面第四层的约定兜底。

## 第四层：通信与双运行模式

子应用在运行时导出 qiankun 生命周期，并区分「被嵌入」和「独立启动」两种状态：

```tsx
// 子应用 src/app.tsx
export const rootContainer = (children: ReactNode) => (
  <div id={APP_ROOT_ID}>{children}</div>   // 样式收敛到自己的根节点
);

export const qiankun = {
  async bootstrap() {},
  async mount() {
    // 加 class 切换到嵌入态样式（比如隐藏自己的顶部导航）
    document.getElementById(APP_ROOT_ID)?.classList.add('embedded');
  },
  async unmount() {
    document.getElementById(APP_ROOT_ID)?.classList.remove('embedded');
  },
};

export const layout: RunTimeLayoutConfig = () => {
  // 被宿主嵌入时，全局状态（用户信息、权限）从宿主来
  const qiankunState = useModel('@@qiankunStateFromMaster');
  // 独立启动时，走 StandaloneResourceView：idle → loading → ready/error，
  // 自己请求一份全局状态再渲染
};
```

两个设计值得展开：

**① 双运行模式（standalone-able）。** 子应用判断自己是否运行在 qiankun 环境里：是，就消费宿主下发的 `@@qiankunStateFromMaster`；否（独立 `max dev`），就渲染一个加载态视图、自己拉全局状态。这让子应用可以**完全脱离宿主开发调试**——不需要为了改一个页面把宿主和登录体系全跑起来。

**② 样式隔离的手动兜底。** 平台一共有 7 个子应用共存，qiankun 的样式沙箱在关闭/兼容场景下并不可靠，所以约定：任何全局样式（antd 主题、reset、暗色变量）都必须挂在子应用自己的根节点 `#app-root` 之下，**禁止直接操作 `document.documentElement`**——否则一个子应用切暗色模式，其他 6 个全跟着变色。这条约定写进了子应用模板仓库的迁移 Skill，新建子应用时自动继承。

## 宿主侧的兜底

master 配置里还有两个不起眼的选项，实际很关键：

```ts
qiankun: {
  master: {
    defaultLoader: '@/components/QiankunMicroAppLoader',   // 统一加载动画
    defaultErrorBoundary: '@/components/MicroAppErrorBoundary', // 挂载失败兜底页
    prefetch: 'all',   // 主应用启动后预取所有子应用静态资源
  },
},
```

- `prefetch: 'all'` 用宿主空闲时间预取子应用资源，用户第一次点进 `/data` 菜单时几乎无感——微前端最大的体验代价（首进子应用白屏）用带宽换掉了；
- `defaultErrorBoundary` 把子应用加载失败的裸露堆栈换成对齐 403 页的兜底 UI——**子应用挂了不能拖垮宿主**，这是微前端的故障隔离承诺，要有看得见的兑现。

## 小结：这套架构的账

| 收益 | 代价 | 我们的对策 |
|---|---|---|
| 新业务不碰老代码，发布互不阻塞 | 首进子应用多一次资源加载 | `prefetch: 'all'` 预取 |
| 子应用独立部署、按业务扩容 | 7 个应用的全局样式易互相污染 | 样式收敛到各自根节点 + 模板 Skill 固化约定 |
| 一份宿主镜像跑多环境 | entry 配置多了一层运行时注入 | start.sh 生成 config.js，优先级降级清晰 |
| 子应用可独立开发 | 双运行模式有额外代码 | standalone 状态机（idle/loading/ready/error）一次写好进模板 |
| 权限统一在宿主 | 子应用拿不到权限就无法渲染 | customProp 挂载时下发权限点 |

面试一句话版：

> 宿主用通配路由把整个业务菜单挂给子应用；entry 走运行时注册中心（K8s 环境变量注入，一份镜像多环境）；浏览器统一同源 `/micro-apps/` 路径由 nginx / dev-proxy 转发；权限点和全局状态随挂载下发，子应用同时支持独立启动自拉状态。收益是发布隔离和独立扩容，代价（首屏、样式污染）分别用预取和根节点样式约定兜底。
