---
title: "MyBatisPlus入门"
published: 2020-04-14
description: "1、导入对应的依赖 2、研究依赖如何配置 3、代码如何编写 4、提高扩展技术能力"
tags: ["Java", "MyBatisPlus"]
category: ""
draft: false
---

# 快速入门

使用第三方组件：  
  
1、导入对应的依赖  
2、研究依赖如何配置  
3、代码如何编写  
4、提高扩展技术能力  
  

```plain
步骤
```

1、创建数据库，2、创建数据表，3、编写项目，初始化项目，4、导入依赖,注意**不要同时导入Mybatis和MyBatis-plus**  
引入 spring-boot-starter、spring-boot-starter-test、mybatis-plus-boot-starter、lombok、h2 依赖：  

```xml
<!-- lombok -->
<dependency>
  <groupId>org.projectlombok</groupId>
  <artifactId>lombok</artifactId>
  <optional>true</optional>
</dependency>
<!-- 数据库驱动 -->
<dependency>
  <groupId>mysql</groupId>
  <artifactId>mysql-connector-java</artifactId>
</dependency>
<!-- mybatisPlus 并不是官方的 -->
<dependency>
  <groupId>com.baomidou</groupId>
  <artifactId>mybatis-plus-boot-starter</artifactId>
  <version>3.3.1.tmp</version>
</dependency>
```

Mysql 5和8驱动不同5：com.mysql.jdbc.Driver;  
8：com.mysql.cj.jdbc.Driver、需要增加时区的配置（驱动8兼容mysql 5版本）  

```yml
# mysql 8
spring.datasource.username=root
spring.datasource.password=123456
spring.datasource.url=jdbc:mysql://localhost:3306/数据库?useSSL=false&useUnicode=true&characterEncoding=utf-8&serverTimezone=GMT%2B8
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
```

#### 主键生成策略

分布式系统唯一id生成：<https://www.cnblogs.com/haoxinyue/p/5208136.html>

#### 雪花算法

snowflake是Twitter开源的分布式ID生成算法，结果是一个long型的ID。其核心思想是：使用41bit作为毫秒数，10bit作为机器的ID（5个bit是数据中心，5个bit的机器ID），12bit作为毫秒内的流水号（意味着每个节点在每毫秒可以产生 4096 个 ID），最后还有一个符号位，永远是0。

## 代码自动生成器

MyBatis-Plus 从 3.0.3 之后移除了代码生成器与模板引擎的默认依赖，需要手动添加相关依赖：  
添加 代码生成器 依赖  

```xml
<dependency>
  <groupId>com.baomidou</groupId>
  <artifactId>mybatis-plus-generator</artifactId>
  <version>3.3.1.tmp</version>
</dependency>
```

添加 模板引擎 依赖，MyBatis-Plus 支持 Velocity（默认）、Freemarker、Beetl，用户可以选择自己熟悉的模板引擎，如果都不满足您的要求，可以采用自定义模板引擎。  

```xml
<dependency>
  <groupId>org.apache.velocity</groupId>
  <artifactId>velocity-engine-core</artifactId>
  <version>2.2</version>
</dependency>
```

```java
package com.xkcoding.helloworld;
import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.generator.AutoGenerator;
import com.baomidou.mybatisplus.generator.config.DataSourceConfig;
import com.baomidou.mybatisplus.generator.config.GlobalConfig;
import com.baomidou.mybatisplus.generator.config.PackageConfig;
import com.baomidou.mybatisplus.generator.config.StrategyConfig;
import com.baomidou.mybatisplus.generator.config.po.TableFill;
import com.baomidou.mybatisplus.generator.config.rules.DateType;
import com.baomidou.mybatisplus.generator.config.rules.NamingStrategy;

import java.util.ArrayList;


// 代码自动生成器
public class AutoGeneratorCode {
    public static void main(String[] args) {
        AutoGenerator mpg = new AutoGenerator();
        // 配置策略
        //1、全局策略
        GlobalConfig gc = new GlobalConfig();
        String projectPath = System.getProperty("user.dir");
        gc.setOutputDir(projectPath+"/src/main/java"); // 设置生成地址
        gc.setAuthor("Amadeus");  // 设置作者
        gc.setOpen(false); //文件创建好是否打开文件管理器
        gc.setFileOverride(false); // 是否覆盖文件
        gc.setServiceName("%sService"); //去Service的I 前缀
        gc.setIdType(IdType.ID_WORKER);
        gc.setDateType(DateType.ONLY_DATE);
        gc.setSwagger2(true);
        mpg.setGlobalConfig(gc);
        // 设置数据源
        DataSourceConfig dsc = new DataSourceConfig();
        dsc.setUrl("jdbc:mysql://localhost:3306/muxin-dev?useSSL=false&useUnicode=true&characterEncoding=utf-8&serverTimezone=GMT%2B8");
        dsc.setDriverName("com.mysql.cj.jdbc.Driver");
        dsc.setUsername("root");
        dsc.setPassword("密码");
        dsc.setDbType(DbType.MYSQL); // 数据库类型
        mpg.setDataSource(dsc);
        // 包的配置  生成哪些包
        PackageConfig pc = new PackageConfig();
        pc.setModuleName("blog"); // 模块名
        pc.setParent("com.xkcoding.helloworld"); // 生成在哪个包下
        pc.setEntity("entity"); // 生成实体 models
        pc.setMapper("mapper");
        pc.setService("service");
        pc.setController("controller");
        mpg.setPackageInfo(pc);
        // 策略配置
        StrategyConfig strategy = new StrategyConfig();
        strategy.setInclude("user"); // 设置要映射的表名，可以写多个
         strategy.setTablePrefix(new String[] { "user_" });// 此处可以修改为表的前缀
        strategy.setNaming(NamingStrategy.underline_to_camel);
        strategy.setColumnNaming(NamingStrategy.underline_to_camel);
        strategy.setEntityLombokModel(true); // 自动lombok
        strategy.setLogicDeleteFieldName("deleted"); // 设置逻辑删除
        // 自动填充配置
        TableFill gmtCreate = new TableFill("gmt_create", FieldFill.INSERT);
        TableFill gmtModified = new TableFill("gmt_modified", FieldFill.INSERT_UPDATE);
        ArrayList<TableFill> tableFills = new ArrayList<>();
        tableFills.add(gmtCreate);
        tableFills.add(gmtModified);
        strategy.setTableFillList(tableFills);
        // 乐观锁
        strategy.setVersionFieldName("version");
        strategy.setRestControllerStyle(true);
        strategy.setControllerMappingHyphenStyle(true); // localhost:8080/hello_id_2
        mpg.setStrategy(strategy);
        mpg.execute(); // 执行
    }
}
```
