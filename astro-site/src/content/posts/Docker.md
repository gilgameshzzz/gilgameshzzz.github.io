---
title: "Docker"
published: 2019-02-28
description: "Docker - Debian - cgroup / nameplace"
tags: ["Docker"]
category: ""
draft: false
---

# Docker



Docker - Debian - cgroup / nameplace

RabbitMQ - 消息服务 -Ruby

ElasticSearch / Solr - 搜索引擎 - Java



虚拟机 - 屏蔽软硬件环境的差异  - VMware / virtual Box

重量级容器（占用的系统资源多）

Nginx / MySQL / Redis / RabbitMQ



#### 安装Docker

yum -y intsall docker-io

-  启动Docker 服务

  systemctl start docker

- 查看镜像

  docker images

 下载mysql5.7 镜像(安装盘)

Docker pull mysql:5.7（镜像名：版本号）

#### 创建容器（nginx)

  docker run -d -p 80:80 --name  nginx(容器名字)  nginx

​    创建容器（mysql)

 docker run -d -p 3306:3306 --name mysql57 -e MYSQL_ROOT_PASSWORD=123456 mysql:5.7

查看进程信息

netstat -nap | grep 

查看所有容器

docker container ls -a

查看已经启动的容器

docker ps

启动/停止容器

docker start /stop 容器名





#### Redis - 基于内存的kv的数据库 

Redis提供了两种持久化方法

​		RDB - 内存中的数据放入一个二进制的dump文件中

​		AOF - 用一个文件记录用户操作的命令 - 每秒记录一次用户操作

docker run -d -p  6379:6379 --name redis-master redis

redis-server --appendonly  yes  --requirepass tmz55555



docker run -d --link redis-master:redis-master --name redis-slave-1 redis:latest redis-server -- slaveof redis-mater 6379 --masterauth tmz55555 

docker run -d --link redis-master:redis-master --name redis-slave-2 redis:latest redis-server -- slaveof redis-mater 6379 --masterauth tmz55555 

docker run -d --link redis-master:redis-master --name redis-slave-3 redis:latest redis-server -- slaveof redis-mater 6379 --masterauth tmz55555
