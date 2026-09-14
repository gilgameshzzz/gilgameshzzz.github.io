---
title: "Redis Sentinel哨兵"
published: 2019-05-09
description: "该方案由一个或多个Sentinel实例组成的Sentinel系统可以监视任意多个主服务器，以及这些主服务器属下的所有从服务器，并在被监视的主服务器进行下线状态时，自动将下线主服务器属下的某个从服务器升级为新的主服务器，然…"
tags: ["Redis"]
category: ""
draft: false
---

## Redis-Sentinel是Redis官方推荐的高可用性(HA)解决方案

  该方案由一个或多个Sentinel实例组成的Sentinel系统可以监视任意多个主服务器，以及这些主服务器属下的所有从服务器，并在被监视的主服务器进行下线状态时，自动将下线主服务器属下的某个从服务器升级为新的主服务器，然后由新的主服务器代替已下线的主服务器继续处理命令请求。Redis提供的sentinel（哨兵）机制，通过sentinel模式启动redis后，自动监控master/slave的运行状态，基本原理是：心跳机制+投票裁决，主要功能：

- **监控**，Sentinel不断地监控redis是否按照预期良好地运行;
- **提醒**，如果发现某个redis节点运行出现状况，Sentinel 可以通过 API 向管理员或者其他应用程序发送通知。或能够通知另外一个进程(例如它的客户端)。
- **自动故障迁移**，当一个master节点不可用时，能够选举出master的多个slave(如果有超过一个slave的话)中的一个来作为新的master,其它的slave节点会将它所追随的master的地址改为被提升为master的slave的新地址。
- **自动更新配置信息**：哨兵提供了认证和服务发现，客户端连接到哨兵去获取当前redis主服务器地址，如果发生故障转移，哨兵将会汇报新的服务器地址。每次进行主从切换时，sentinel配置文件自动更新。

## 运行Sentinel

第一种：  

```plain
redis-sentinel /path/to/sentinel.conf
```

第二种：  

```plain
redis-server /path/to/sentinel.conf --sentinel
```

无论使用哪种都需要指定一个配置文件，sentinel默认26379端口。

## Sentinel配置

```plain
[root@DB ~]# vim /sentinel.conf 
port 26379
daemonize yes #程序后台执行
logfile "/var/log/sentinel.log"
dir "/tmp"
#第一次设置哨兵时此ip一定要设置为redis集群中的主ip
sentinel monitor mymaster 127.0.0.1 6379 2 
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 6000
sentinel config-epoch mymaster 7
sentinel parallel-syncs mymaster 1
```

**sentinel monitor mymaster 127.0.0.1 6379 2**  
  这一行代表sentinel监控的master的名字叫做mymaster,地址为127.0.0.1:6379，行尾最后的一个2代表,当集群中有2个sentinel认为master死了时，才能真正认为该master已经不可用了。（sentinel集群中各个sentinel也有互相通信，通过gossip协议）。

除了第一行配置，剩下的配置都有一个统一的格式:  

```plain
sentinel <option_name> <master_name> <option_value>
```

- down-after-milliseconds

  表示：如果master在“一定时间范围”内不回应PONG 或者是回复了一个错误消息，那么这个sentinel会主观地(单方面地)认为这个master已经不可用了(subjectively down, 也简称为SDOWN)。而这个down-after-milliseconds就是用来指定这个“一定时间范围”的，单位是毫秒。

- parallel-syncs

  在发生failover主备切换时，这个选项指定了最多可以有多少个slave同时对新的master进行同步，这个数字越小，完成failover所需的时间就越长，但是如果这个数字越大，就意味着越多的slave因为replication而不可用。可以通过将这个值设为 1 来保证每次只有一个slave处于不能处理命令请求的状态。

​ [Redis Sentinel机制与用法(二)](https://segmentfault.com/a/1190000002685515)

## python访问Sentinel集群

```python
from redis.sentinel import Sentinel #加载redis模块
# 连接哨兵服务器
sentinel = Sentinel([('192.168.221.160', 26379),
       ('192.168.221.161', 26379)], socket_timeout=0.1)
       
sentinel.discover_master('mymaster') #获取主redis服务器地址

sentinel.discover_slaves('mymaster')#获取从redis服务区地址

master = sentinel.master_for('mymaster', socket_timeout=0.1)
master.set('foo','bar') #获取主redis服务器并进行写入

slave = sentinel.slave_for('mymaster', socket_timeout=0.1)
slave.get('foo')#获取从redis服务器进行获取
```
