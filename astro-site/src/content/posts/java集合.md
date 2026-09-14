---
title: "Java集合，泛型，spring注解、事务的一些问题"
published: 2020-04-24
description: "Java的集合类主要由两个接口派生而出：Collection和Map,Collection和Map是Java集合框架的根接口。代表了两种不同的数据结构：集合和映射表。"
tags: ["Java"]
category: "Java"
draft: false
---

## java 集合类之间的继承关系

Java的集合类主要由两个接口派生而出：Collection和Map,Collection和Map是Java集合框架的根接口。代表了两种不同的数据结构：集合和映射表。

![collection](/img/collection.png)

图中，ArrayList,HashSet,LinkedList,TreeSet是我们经常会有用到的已实现的集合类。

Map实现类用于保存具有映射关系的数据。Map保存的每项数据都是key-value对，也就是由key和value两个值组成。Map里的key是不可重复的，key用户标识集合里的每项数据。

![map](/img/map.png)

## 迭代器的作用

由于Java中数据容器众多，而对数据容器的操作在很多时候都具有极大的共性，于是Java采用了迭代器为各种容器提供公共的操作接口

**解耦效果**：使用迭代器iterator可以使对容器的遍历操作完全与其底层相隔离，可以到达极好的解耦效果

iterator方法返回一个实现了Iterator接口的对象，作用是依次访问集合中的元素，Iterator接口包含3个方法：

```
boolean hasNext();  # 如果任有元素可以迭代，则返回true.
E next();  			# 返回迭代的下一个元素
void remove(); 		# 从迭代器指向的collection中移除迭代器返回的最后一个元素(可选操作)
```

通过多次调用next()方法可遍历集合中的所有元素，需要注意的是需要在调用next()之前调用hasNext()方法，并在hasNext()返回true的时候才可以调用next().

```java
public static void main(String[] args)
{
        List<String> list=new ArrayList<>();
        list.add("C++");
        list.add("python");
        list.add("java");
        for(Iterator<String> it=list.iterator();it.hasNext();)
        {
            String item = it.next();
            if("python".equals(item)){
              // list.remove(item);  // 翻车写法：下次 it.next() 会抛 ConcurrentModificationException
              it.remove();           // 正确写法
            }
        }
    }
```

遍历集合时删除特定元素一定要用Iterator的remove,别用集合自带的remove。会报错：

java.util.ConcurrentModificationException  
在集合内部维护一个字段modCount用于记录集合被修改的次数，每当集合内部结构发生变化(add,remove，set)时，modCount+1。　　  
在迭代器内部也维护一个字段expectedModCount，同样记录当前集合修改的次数，初始化为集合的modCount值。调用Iterator遍历时，每次next()都会检查modCount和expectedModCount是否相等，不等就抛出并发修改异常java.util.ConcurrentModificationException。**最典型的场景恰恰是单线程**——自己在for循环里调了list.remove()，集合的modCount变了而迭代器的expectedModCount没变。多线程下别的线程改集合同样会触发。注意它是fail-fast机制，只保证尽快发现问题，不保证一定能检测到。![ConcurrentModificationException](/img/ConcurrentModificationException.png)

## 集合的排序

java集合的工具类Collections中提供了两种排序的方法,分别是:

1. Collections.sort(List list)
2. Collections.sort(List list,Comparator c)

第一种称为自然排序,参与排序的对象需实现comparable接口,**缺点会入侵代码**

第二种叫定制排序,或自定义排序,需编写匿名内部类,先new一个Comparator接口的比较器对象,优点不用修改排序对象代码，例子：

```java
Collections.sort(ordered, new Comparator<Student>() {
      @Override
      public int compare(Student t1, Student t2) {
        return (int) (t1.getOrder() - t2.getOrder());
      }
    });
```

java8函数式排序

```java
//根据学生身高排序
list.sort(Comparator.comparing(Student::getHeight).reversed())
```

## 泛型

泛型类

```java
class Demo<T>{
    public T fun(T t){
        return t;
    }
    public <T> T fun2(T t){
        return t;
    }
}
```

![](/img/泛型.png)

**泛型类的方法**和**泛型方法**区别：

- 一个是在实例化对象才确认下来的 【泛型类的方法】
- 一个是在方法调用时确认下来的 【泛型方法】

### 普通泛型类的方法

```java
// 虽然方法中使用了泛型，但这并不是泛型方法
public T fun(T t){           // 可以接收任意类型的数据
    return t;                // 直接把参数返回
}
```

加static会编译错误

### 泛型方法

可以加static

```java
// 这个<T>修饰的方法才是真的泛型方法
public static <T> T fun2(T t){          // 可以接收任意类型的数据
    return t;                           // 直接把参数返回
}
```

### 泛型方法总结

- **泛型类，是在 【实例化类】 的时候指明泛型的具体类型；**
- **泛型方法，是在调用方法的时候指明泛型的具体类型** ，注意跟类实例化没关系了。
- **泛型方法可以加static,普通的泛型类的方法是不可以的**

### 使用泛型方法好处

- 因为泛型方法类型可以**灵活的传入参数类型**，不像泛型类的方法实例化后就固定掉了。
- 每次调用泛型方法入参类型都可以灵活的变化，可以看我的例子
- 泛型方法支持static

## spring注解、事务传播机制

### **7种事务的传播机制（可通过spring配置或注解来设置）**

1. REQUIRED（默认）：支持使用当前事务，如果当前事务不存在，创建一个新事务。
2. SUPPORTS：支持使用当前事务，如果当前事务不存在，则不使用事务。
3. MANDATORY：中文翻译为强制，支持使用当前事务，如果当前事务不存在，则抛出Exception。
4. REQUIRES\_NEW：创建一个新事务，如果当前事务存在，把当前事务挂起。
5. NOT\_SUPPORTED：无事务执行，如果当前事务存在，把当前事务挂起。
6. NEVER：无事务执行，如果当前有事务则抛出Exception。
7. NESTED：嵌套事务，如果当前事务存在，那么在嵌套的事务中执行。如果当前事务不存在，则表现跟REQUIRED一样。

### 事务注解失效的例子

```java

public class WePageManagerServiceImpl implements WePageManagerService {

    @Override
    public void pagePublish(MysRequest request) {
        PublishHandler(request);
    }

    @Transactional(rollbackFor = Exception.class)
    protected ProcResult<String> PublishHandler(WePagePublishRequest request) {
        //多表dao操作......
    }
}
```

### 解决方案：把事务代码下沉,用一个类去单独处理

```java
public class WePageManagerServiceImpl implements WePageManagerService {

    @Autowired
    private MyTransaction myTransaction;

    @Override
    public void pagePublish(MysRequest request) {
       myTransaction.pagePublishHandler(request);
    }
}

@Service
@Transactional(rollbackFor = Throwable.class)
public class MyTransactionImpl implements MyTransaction{
    protected ProcResult<String> pagePublishHandler(WePagePublishRequest request) {
        //多表dao操作......
    }
}
```

@Transactional**失效原因分析：自身调用导致失败**

在应用系统调用声明@Transactional 的目标方法时，Spring Framework 默认使用 AOP 代理，在代码运行时生成一个代理对象，再由这个代理对象来统一管理，当在Service实现类直接调用内部方法时，其本质是通过this对象来调用的方法，而不是代理对象，因为会出现事务失效的情况

总结一句话，**自身调用没有经过 Spring 的代理类**

**事务失效3种常见原因**

- 自身调用（面试最爱问啦）
- 异常被吃
- 异常抛出类型

[参考内容-微信](https://mp.weixin.qq.com/s?__biz=MzA4NzQ0Njc4Ng==&mid=2247485704&idx=1&sn=403faac580b5a4df8c0ad52d488fb59d&chksm=90380d65a74f847352f3792aeefd09f34cf28f082400917f9b1fdf26cfac435a54316eb0b328&scene=126&sessionid=1587719861&key=7a384acef7f5f4afc36c937135ad3926050d02aac9b3af4026ce6c49b54f270785f99728e6452babd861dad566b8da26113447843f7b3af55909d5433fc983cb16da5e89a312efa70eeb8f6929f428cf&ascene=1&uin=Mjg5MjMxNTQxMA%3D%3D&devicetype=Windows+10&version=62080079&lang=zh_CN&exportkey=A11GMdesik4lH9%2FEA1zySOc%3D&pass_ticket=cCRSLB2olzvtMXc6W%2FhQRmQOmaS%2BKEBVtkxlBUyxsIgb%2BL42ZloZw3WsR1GhVEfM)
