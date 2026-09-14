---
title: "MongoDB删除重复数据和唯一索引"
published: 2019-06-03
description: "1.根据pid分组并统计数量，group只会返回参与分组的字段，使用addToSet在返回结果数组中增加\\id字段"
tags: ["MongoDB"]
category: "数据库"
draft: false
---

MongoDB 版本 V4.0.9

> **时效注记（2026 更新）**：本文写于 MongoDB 4.0 时期，其中 `ensureIndex` 和 `remove` 两个 API 后来都被移除了，下面的代码已同步更新为现行写法，并在各节标注了差异。

## 删除MongoDB删除重复数据

```javascript
db.CompanyId.aggregate([{$group:{ _id:{'pid':'$pid'},count:{$sum: 1},dups: {$addToSet: '$_id'}}}, {$match: {count: {$gt: 1}}}]).forEach(function(doc){
doc.dups.shift();db.CompanyId.deleteMany({_id: {$in: doc.dups}});})
```

> 原文用的是 `db.CompanyId.remove()`。`remove()` 自 MongoDB 3.2 起被 `deleteOne()` / `deleteMany()` 取代，新版驱动和 mongosh 中已移除，这里按批量删除的语义改成了 `deleteMany`。

1.根据pid分组并统计数量，`$group`只会返回参与分组的字段，使用`$addToSet`在返回结果数组中增加\_id字段

2.使用`$match`匹配数量大于1的数据

3.doc.dups.shift();表示从数组第一个值开始删除；作用是踢除重复数据其中一个\_id，让后面的删除语句不会删除所有数据

4.使用forEach循环根据\_id删除数据，`$addToSet` 操作符只有在值没有存在于数组中时才会向数组中添加一个值。如果值已经存在于数组中，`$addToSet`返回，不会修改数组。

注意：forEach和`$addToSet`的驼峰写法不能全部写成小写，因为mongodb严格区分大小写、mongodb严格区分大小写、mongodb严格区分大小写，重要的事情说三遍！

聚合框架它是数据聚合的一个新框架，其概念类似于数据处理的管道。 每个文档通过一个由多个节点组成的管道，每个节点有自己特殊的功能（分组、过滤等），文档经过管道处理后，最后输出相应的结果。

管道基本的功能有两个：  
一是对文档进行“过滤”，也就是筛选出符合条件的文档;  
二是对文档进行“变换”，也就是改变文档的输出形式。

## MongoDB唯一索引

在 createIndex 命令中指定 `unique: true` 即可创建唯一索引

```javascript
db.CompanyId.createIndex({字段1: 1, 字段2: 1}, {unique: true});
```

字段1：1，中的1表示升序，-1表示降序

> 原文用的是 `ensureIndex`。该方法自 MongoDB 3.0 起就是 `createIndex` 的别名，**5.0 已彻底移除**，在新版本上执行会直接报错。另外要注意：如果集合里已有重复数据，创建唯一索引会失败——所以本文前半部分的去重要先做。

## MongoDB 查询两个字段的值相同的数据

因为MongoDB 不是关系型数据库，不可以直接使用”…Where 字段A=字段B”的方式来查找字段相同的条目，但可以使用“`$where`”

```javascript
db.foo.find({"$where":function(){
 for(var current in this){
   for(var other in this){
     if(current != other && this[current] == this[other]){
       return true;
     }
   }
 }
 return false;
}})
```

> `$where` 现在已**不推荐使用**：它需要为每个文档启动 JavaScript 解释器，无法利用索引，全集合扫描，性能很差；而且执行任意 JS 有注入风险。现在优先用 `$expr` 配合聚合表达式，例如比较两个已知字段是否相等：
>
> ```javascript
> db.foo.find({$expr: {$eq: ["$字段A", "$字段B"]}})
> ```
>
> 本文这个「任意两个字段相等」的需求因为要遍历未知字段名，`$expr` 表达不了，更适合放到应用层或用聚合管道的 `$objectToArray` 处理。
