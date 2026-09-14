---
title: "Docker"
published: 2019-02-28
description: "Docker 入门笔记：安装、镜像与容器操作、用容器跑 MySQL / Nginx / Redis 主从。原文命令已按现行版本更正。"
tags: ["Docker"]
category: "运维部署"
draft: false
---

> **时效注记（2026 更新）**：本文是 2019 年的入门笔记，原文里的安装命令（`docker-io` 包）、`--link` 参数、Redis 的 `slaveof` 写法都已过时或本身有拼写错误，照抄跑不通。下面的命令已更正为现行可执行版本，并在各处标注了变化。

Docker 基于 Linux 的 cgroup / namespace 实现，是**轻量级**的隔离方案——和虚拟机的区别在于它不虚拟硬件、不跑独立内核，直接共享宿主机内核。

虚拟机（VMware / VirtualBox）屏蔽的是软硬件环境差异，属于重量级方案，占用系统资源多。

适合用容器跑的常见中间件：Nginx / MySQL / Redis / RabbitMQ / ElasticSearch。

## 安装 Docker

```bash
# 原文写的是 yum -y intsall docker-io
# 一是 intsall 拼写错误，二是 docker-io 这个包早已废弃
# 现在用官方脚本或 docker-ce 包
curl -fsSL https://get.docker.com | sh

# 或者 CentOS / RHEL 手动装
sudo dnf install -y docker-ce docker-ce-cli containerd.io
```

启动服务并设为开机自启：

```bash
sudo systemctl start docker
sudo systemctl enable docker
```

## 镜像与容器基本操作

```bash
# 查看本地镜像
docker images

# 下载镜像（原文写成大写 Docker pull，命令区分大小写，跑不了）
docker pull mysql:5.7          # 格式为 镜像名:版本号

# 查看已启动的容器
docker ps

# 查看所有容器（含已停止的）
docker ps -a

# 启动 / 停止容器
docker start 容器名
docker stop 容器名

# 查看端口占用（原文 grep 后面漏了参数）
netstat -nap | grep 3306
# 更推荐用 docker 自己的命令
docker port 容器名
```

## 创建容器

Nginx：

```bash
docker run -d -p 80:80 --name nginx nginx
```

MySQL：

```bash
docker run -d -p 3306:3306 --name mysql57 \
  -e MYSQL_ROOT_PASSWORD=你的密码 \
  mysql:5.7
```

`-d` 后台运行，`-p 宿主机端口:容器端口` 做端口映射，`--name` 指定容器名，`-e` 传环境变量。

> 密码别像原文那样直接写在命令里——它会进 shell 历史和 `docker inspect` 的输出。生产环境用 `--env-file` 或 secret。

## Redis 主从

Redis 提供两种持久化方式：

- **RDB** —— 把内存中的数据快照存成二进制 dump 文件
- **AOF** —— 用一个文件记录写命令，默认每秒 fsync 一次

先起主节点。注意 Redis 镜像的入口就是 `redis-server`，配置参数直接跟在镜像名后面：

```bash
docker network create redis-net

docker run -d --name redis-master --network redis-net \
  -p 6379:6379 redis \
  redis-server --appendonly yes --requirepass 你的密码
```

再起从节点：

```bash
docker run -d --name redis-slave-1 --network redis-net redis \
  redis-server --replicaof redis-master 6379 \
               --masterauth 你的密码 \
               --requirepass 你的密码
```

> 原文这条命令有四个问题：
>
> 1. `--link` 已是 legacy 特性，官方明确不推荐，应改用自定义 network（上面的 `redis-net`）——同一网络内容器可直接用容器名互相访问
> 2. `-- slaveof` 中间多了个空格，参数解析不了
> 3. `redis-mater` 拼错了，应为 `redis-master`
> 4. Redis 5.0 起 `slaveof` 更名为 `replicaof`（旧名仍兼容但已不推荐）
>
> 另外从节点自己也要设 `--requirepass`，否则从节点是无密码裸奔的。

验证主从是否建立：

```bash
docker exec -it redis-master redis-cli -a 你的密码 info replication
```

输出里 `connected_slaves` 应该等于从节点数量。
