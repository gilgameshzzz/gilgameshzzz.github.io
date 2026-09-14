---
title: "MongoDB删除重复数据和唯一索引"
published: 2019-06-03
description: "1.根据pid分组并统计数量，group只会返回参与分组的字段，使用addToSet在返回结果数组中增加\\id字段"
tags: ["MongoDB"]
category: ""
draft: false
---

MongoDB 版本V4.0.9

## 删除MongoDB删除重复数据

```plain
db.CompanyId.aggregate([{$group:{ _id:{'pid':'$pid'},count:{$sum: 1},dups: {$addToSet: '$_id'}}}, {$match: {count: {$gt: 1}}}]).forEach(function(doc){
doc.dups.shift();db.CompanyId.remove({_id: {$in: doc.dups}});})
```

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

在ensureIndex 命令中指定”unique:true”即可创建唯一索引  

```plain
db.CompanyId.ensureIndex({字段1: 1, 字段2: 1}, {unique: true});
```

字段1：1，中的1表示升序，-1表示降序

## MongoDB 查询两个字段的值相同的数据

因为MongoDB 不是关系型数据库，不可以直接使用”…Where 字段A=字段B”的方式来查找字段相同的条目，但可以使用“`$where`”  

```plain
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
