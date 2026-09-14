---
title: "Java并发-AQS-ReentrantLock"
published: 2020-04-22
description: "在synchronized未优化之前，我们在编码中使用最多的同步工具类应该是ReentrantLock类，ReentrantLock拥有优化后synchronized关键字的性能，又提供了更多的灵活性。相比synchro…"
tags: ["Java", "并发"]
category: "Java"
draft: false
---

## 前言

在`synchronized`未优化之前，我们在编码中使用最多的同步工具类应该是`ReentrantLock`类，`ReentrantLock`拥有优化后`synchronized`关键字的性能，又提供了更多的灵活性。相比`synchronized`，他在功能上更加强大，具有等待可中断，公平锁以及绑定多个条件等`synchronized`不具备的功能。

## ReentrantLock 与AQS(AbstractQueuedSynchronizer)的关系

在使用ReentrantLock 类时，第一步实例化 **new ReentrantLock()**,他的实例化源码

```java
public ReentrantLock() {
    sync = new NonfairSync();
}

public ReentrantLock(boolean fair) {
    sync = fair ? new FairSync() : new NonfairSync();
}
```

通过名字可以看出是公平锁和非公平锁的实现，默认情况下ReentrantLock使用非公平锁，那么sync字段是怎么实现的？看sync的代码

```java
private final Sync sync;

abstract static class Sync extends AbstractQueuedSynchronizer {......}

static final class NonfairSync extends Sync {......}

static final class FairSync extends Sync {......}
```

到这里就发现了`AbstractQueuedSynchronizer`类，公平锁和非公平锁其实都是在`AbstractQueuedSynchronizer`的基础上实现的，也就是AQS。AQS提供了`ReentrantLock`实现的基础。

### AQS

AQS全称`AbstractQueuedSynchronizer`，翻译为抽象队列同步器，他是构建JUC包下并发工具类的基础框架，提供了可中断锁，超时锁，独占锁，共享锁等等，它没有利用高级机器指令，也没有利用JDK编译时的特殊处理，仅仅是一个普通的类，就实现了并发的控制。

#### 功能特点：

**1、等待中断**。synchronized不可以被中断，指的是synchronized等待不可中断，一旦进入阻塞状态，就无法被中断。只能通过调用的方法抛出InterruptedException异常，那么它就可以被中断，不抛出InterruptedException的方法是不可中断的。

**2、锁超时**。AQS支持超时锁，可以指定一个时间，如果指定时间内没有获取锁，就直接退出获取锁。

**3、非阻塞**。尝试获取锁失败，并不进入阻塞状态，而是直接返回，那这个线程也有机会释放曾经持有的锁。

AQS底层采用的是状态标志位（state变量）+ FIFO队列的方式来记录获取锁、释放锁、竞争锁等一系列操作。对于AQS而言,其中的**state变量可以看做是锁**，队列采用的是先进先出的双向链表，**state共享状态变量表示锁状态**，内部使用CAS对state进行原子操作修改来完成锁状态变更（锁的持有和释放）。  
![](/img/AQS.png)

### AQS核心

#### 状态state

```java
private volatile int state;    
protected final int getState() {        
  return state;    
}    

protected final void setState(int newState) {        
  state = newState;    
}    

protected final boolean compareAndSetState(int expect, int update) {        
    return unsafe.compareAndSwapInt(this, stateOffset, expect, update);    
}
```

state状态这里还是比较简单的，使用volatile修饰，保证state变量的可见性， setState(int newState)方法只是用作给state进行初始化，而compareAndSetState(int expect, int update)用作了在运行期间对state变量的修改。

为什么要单独多出来一个compareAndSetState方法对state变量进行修改呢？

因为对共享变量的赋值，不是原子操作需要额外的锁同步，我们可能想到使用synchronized来保证原子性，但是**synchronizedh会使线程阻塞**，导致线程上下文的切换，影响其性能。这里采用的是CAS无锁操作，但是CAS也是有不足的，它会进行自旋操作，这样也会对CPU的资源造成浪费。

#### 同步队列FIFO

AQS会把没有争抢到锁的线程包装成Node节点，加入队列中：

```java
static final class Node {   
    //标记节点是共享模式    
    static final Node SHARED = new Node();    
 	//标记节点是独占的    
    static final Node EXCLUSIVE = null;   
    //代表此节点的线程取消了争抢资源    
    static final int CANCELLED =  1;     
    //表示当前node的后继节点对应的线程需要被唤醒    
    static final int SIGNAL    = -1;    
    //这两个状态和condition有关系，这里先不说condition    
    static final int CONDITION = -2;       
    static final int PROPAGATE = -3;   
    // 取值为上面的1、-1、-2、-3 或者 0    
    volatile int waitStatus;    
    volatile Node prev;    
    volatile Node next;   
    //等待线程   
 	volatile Thread thread;    
    Node nextWaiter;    
    final boolean isShared() {        
       return nextWaiter == SHARED;    
    }    
    final Node predecessor() throws NullPointerException {        
        Node p = prev;        
        if (p == null)           
            throw new NullPointerException();       
        else            
            return p;    
    }  
    
    Node() {       
    }    
    
    //线程入队。    
    Node(Thread thread, Node mode) {    
        // Used by addWaiter        
        this.nextWaiter = mode;        
        this.thread = thread;    
    }  
    //使用condition用到    
    Node(Thread thread, int waitStatus) { 
        // Used by Condition       
        this.waitStatus = waitStatus;       
        this.thread = thread;    
    }
}
```

同步队列是AQS的核心，用来实现线程的阻塞和唤醒操作，waitStatus它表示了当前Node所代表的线程的等待锁的状态，在独占锁模式下，我们只需要关注CANCELLED、SIGNAL两种状态即可。nextWaiter属性，它在独占锁模式下永远为null，仅仅起到一个标记作用。

![](/img/queue.png)

#### 独占锁、共享锁

AQS定义两种资源共享方式

- Exclusive （独占模式）：只有一个线程能访问共享资源。如 ReentrantLock
- Share（共享模式）：多个线程可同时访问共享资源，如Semaphore/CountDownLatch）

在独占模式下和synchronized实现的效果是一样的，一次只能有一个线程访问。state 等于0 代表没有线程持有锁，大于0代表有线程持有当前锁。这个值可以大于1，是因为**锁可以重入，每次重入都加上 1，也需要对应的多次释放**。即上锁多少次，就要解锁多少次。

在共享模式下，state的值代表着有多少个许可，但是它在每个具体的工具类里的应用还是有一些差别的。

### ReentrantLock独占锁

实现锁

```java
//ReentrantLock的lock方法
public void lock() {
    sync.lock();
}

//调用了Sync中的lock抽象方法
abstract static class Sync extends AbstractQueuedSynchronizer {
    ......
    /**
        * Performs {@link Lock#lock}. The main reason for subclassing
        * is to allow fast path for nonfair version.
        */
    abstract void lock();
    ......
}
```

`Sync`类的`lock()`方法是一个抽象方法，`NonfairSync()`和`FairSync()`分别对`lock()`方法进行了实现。

```java
//非公平锁的lock实现
static final class NonfairSync extends Sync {
    ......
    /**
        * Performs lock.  Try immediate barge, backing up to normal
        * acquire on failure.
        */
    final void lock() {
        if (compareAndSetState(0, 1)) //插队操作，首先尝试CAS获取锁，0为锁空闲
            setExclusiveOwnerThread(Thread.currentThread()); //获取锁成功后设置当前线程为占有锁线程
        else
            acquire(1);
    }
    ......
}

//公平锁的lock实现
static final class FairSync extends Sync {
    ......
    final void lock() {
        acquire(1);
    }
    ......
}
```

**区别**：`NonfairSync()`会先进行一个CAS操作，将一个state状态从0设置到1，这个也就是上面所说的非公平锁的“插队”操作，前面讲过CAS操作默认是原子性的，这样就保证了设置的线程安全性。

看看跟state有关的源码：

```java
protected final boolean compareAndSetState(int expect, int update) {
    // See below for intrinsics setup to support this
    return unsafe.compareAndSwapInt(this, stateOffset, expect, update);
}

/**
    * The synchronization state.
    */
private volatile int state;

protected final int getState() {
    return state;
}

protected final void setState(int newState) {
    state = newState;
}
```

state变量是一个`volatile`修饰的`int`类型变量，这样就保证了这个变量在多线程环境下的可见性。从变量的注释“The synchronization state”可以看出state代表了一个同步状态。再回到上面的`lock()`方法，在设置成功之后，调用了`setExclusiveOwnerThread`方法将当前线程设置给了一个私有的变量，这个变量代表了当前获取锁的线程，放到了AQS的父类`AbstractOwnableSynchronizer`类中实现。

### 总结

1、AQS中用state属性表示锁，在ReentranLock中当state = 1 获取锁，state = 0代表释放锁， state>1代表重入锁。exclusiveOwnerThread属性代表了占有锁的线程。

2、addWaiter负责将当前等待锁的线程包装成Node,并成功地添加到队列的末尾，这一点是由它调用的enq方法保证的，enq方法同时还负责在队列为空时初始化队列。

3、acquireQueued方法用于在Node成功入队后，继续尝试获取锁（取决于Node的前驱节点是不是head），或者将线程挂起

4、shouldParkAfterFailedAcquire方法用于保证当前线程的前驱节点的waitStatus属性值为SIGNAL,从而保证了自己挂起后，前驱节点会负责在合适的时候唤醒自己。

5、parkAndCheckInterrupt方法用于挂起当前线程，并检查中断状态。

6、如果最终成功获取了锁，线程会从lock()方法返回，继续往下执行；否则，线程会阻塞等待。

[参考链接1-掘金](https://juejin.cn/post/5b7235e951882560ed075893#heading-2)

[参考链接2-掘金](https://juejin.cn/post/5e9d3f01518825739b2d4866#heading-16)
