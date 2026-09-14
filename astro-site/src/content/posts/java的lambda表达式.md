---
title: "java lambda表达式"
published: 2020-05-30
description: "Lambda表达式：引入函数式编程的风格，不是所有的引用数据类型都可以使用lambda表达式 只有SAM接口（函数式接口）类型的形参，变量才可以赋值为Lambda表达式。 函数式接口：SAM(Single Abstrac…"
tags: ["java", "lambda"]
category: ""
draft: false
---

Lambda表达式：引入函数式编程的风格，不是所有的引用数据类型都可以使用lambda表达式  
只有SAM接口（函数式接口）类型的形参，变量才可以赋值为Lambda表达式。  
函数式接口：SAM(Single Abstract Method)表示该接口**只有一个抽象方法**的接口。当然这个接口可以有默认方法和静态方法等成员。如Runable、Comparable, Iterable、reflect、FileFilter

JDK1.8建议，这样的接口加一个注解标记@FunctionalInterface

### 一、消费型接口 ， 特点：有参无返回值

1、最基本的代表： Consumer : void accept(T t)  
2、其他变形 BiConsumer: void accept(T t, U u)  
例如：集合java.util.Collection系列的集合在JDK1.8之后增加的方法  
default void forEach(Consumer<? super T> action)

```java
public class TestConsumer{
    @Test
    public void test(){
        ArrayList<String> list = new ArrayList<>();
        list.add("hello");
        list.add("hello world");
        list.add("hello java");
        list.add("hello lambda");
        // foreach循环
        for (String str:list){
            System.out.println(str);
        }
        // forEach 方法就是等价于foreach循环
        list.forEach(t -> System.out.println(t));
    }
```

### 二、供给型接口 抽象方法：无参有返回值

1、最基本的代表  

```plain
Supplier<T>： T get()
```

2、其他变型：  

```plain
BooleanSupplier  boolean  getAsBoolean()
DoubleSupplier   double   getAsDouble()
IntSupplier         int         getAsInt()
LongSupplier       long       getAsLong()
```

StreamAPI: Stream是一个数据流  
javc.util.stream包Stream类型  

```java
static<T> Stream<T> generate(Supplier<T> s)
```

```java
class TestSupplier{
    @Test
    public void test(){
        // 产生generate, 产生随机数
        Stream<Double> stream = Stream.generate(() -> Math.random());
        stream.forEach(t-> System.out.println(t));
    }
}
```

### 三、判断型（断定型）接口 , 返回值都为布尔值

抽象方法：boolean test(参数)  
 1、最基本的代表  

```plain
Predicate<T> boolean test(T t)
```

2、其他的变形  

```plain
BiPredicate<T,U>  boolean        test(T t,U u)
DoublePredicate  boolean         test(double value)
ntPredicate        boolean         test(int value)
LongPredicate      boolean         test(long value)
```

```
例如： java.util.Collection<E>
default boolean removeIf(Predicate<? super E>filter)
```

```java
class TestPredicate{
    @Test
    public void test(){
        ArrayList<Integer> list = new ArrayList<>();
        for (int i = 1; i <= 10; i++) {
            list.add(i);
        }
        // 删除3的倍数元素
        //第一种
//        Iterator<Integer> iterator = list.iterator();
//        while (iterator.hasNext()){
//            Integer next = iterator.next();
//            if (next%3 ==0){
//                iterator.remove();
//            }
//        }
        // 第二种
        list.removeIf(t-> t%3 ==0);
        list.forEach(t -> System.out.println(t));
    }
}
```

### 四、功能型接口 抽象方法：有参有返回值

1、最基本的代表：Function<T, R> R apply(T t)  
Lambda表达式是给函数式接口的形参或变量赋值用的，为了给这个函数式接口的抽象方法传递代码用  
语法格式：  
（形参列表） ->{lambda体} 解释：  
（形参列表）就是函数式接口的抽象方法的形参列表。  
{lambda体}就是函数式接口的抽象方法的方法体。  
说明：1、当（形参列表）是空参时，那么（）是不能省略的  
2、当（形参列表）是非空参的，并且类型是确定的或者可以推断的，那么形参的数据类型可以省略  
3、当（形参列表）是非空参的，并且只有一个形参，并且类型也省略了，那么此时()也可以省略，如果类型没有省略，那么()也不能省略。  
4、如果{lambda体} 不止一个语句，那么{}不能省略，并且每一个语句都要；结束  
5、如果{lambda体}只有一个语句，那么{}和；可以省略且同时省略  
6、如果有返回值，用return返回,且只有一个return语句时，return、{}、；都同时省略  

```java
public void test(){
       ArrayList<String> list = new ArrayList<>();
       list.add("hello");
       list.add("hello world");
       list.add("hello java");
       list.add("hello lambda");
      //用匿名内部类给Consumer接口的形参赋值
       list.forEach(new Consumer<String>() {
           @Override
           public void accept(String s) {
               System.out.println(s);
           }
       });
       // forEach 方法就是等价于foreach循环
       //  list.forEach((t) -> {System.out.println(t)};); 省略后
       list.forEach(t -> System.out.println(t));
   }
```
