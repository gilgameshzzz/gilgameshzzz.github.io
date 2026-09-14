---
title: "初识Netty"
published: 2020-04-15
description: "1、I/O 模型简单的理解：就是用什么样的通道进行数据的发送和接收，很大程度上决定了程序通信的性能"
tags: ["Java", "Netty"]
category: "Java"
draft: false
---

### I/O 模型基本说明

1、I/O 模型简单的理解：就是用什么样的通道进行数据的发送和接收，很大程度上决定了程序通信的性能

2、Java共支持3种网络编程模型/IO模式：BIO、NIO、AIO

#### BIO

3、Java BIO ： 同步并阻塞(**传统阻塞型**)，服务器实现模式为一个连接一个线程，即客户端有连接请求时服务器端就需要启动一个线程进行处理，如果这个连接不做任何事情会造成不必要的线程开销

![](/img/BIO工作原理.png)

**BIO流程：**

1)服务器端启动一个ServerSocket

2)客户端启动Socket对服务器进行通信，默认情况下服务器端需要对每个客户 建立一个线程与之通讯

3)客户端发出请求后, 先咨询服务器是否有线程响应，如果没有则会等待，或者被拒绝

4)如果有响应，客户端线程会等待请求结束后，在继续执行

**缺点分析：**

1)每个请求都需要创建独立的线程，与对应的客户端进行数据 Read，业务处理，数据 Write 。

2)当并发数较大时，需要**创建大量线程来处理连接**，系统资源占用较大。

3)连接建立后，如果当前线程暂时没有数据可读，则线程就阻塞在 Read 操作上，造成线程资源浪费

#### NIO

4、Java NIO ： **同步非阻塞**，服务器实现模式为一个线程处理多个请求(连接)，即客户端发送的连接请求都会注册到多路复用器上，多路复用器轮询到连接有I/O请求就进行处理 【简单示意图】

①NIO 有三大核心部分：Channel(通道)**，**Buffer(缓冲区)**,** Selector(选择器）

②NIO是 面向 缓冲区 ，或者面向块 编程的。数据读取到一个它稍后处理的缓冲区，需要时可在缓冲区中前后移动，这就增加了处理过程中的灵活性，使用它可以提供**非阻塞**式的高伸缩性网络

③HTTP2.0使用了多路复用的技术，做到同一个连接并发处理多个请求，而且并发请求的数量比HTTP1.1大了好几个数量级

![NIO](/img/NIO.png)

**NIO存在的问题**

1) NIO 的类库和 API 繁杂，使用麻烦：需要熟练掌握 Selector、ServerSocketChannel、SocketChannel、ByteBuffer 等。

2) 需要具备其他的额外技能：要熟悉 Java 多线程编程，因为 NIO 编程涉及到 Reactor 模式，你必须对多线程和网络编程非常熟悉，才能编写出高质量的 NIO 程序。

3) 开发工作量和难度都非常大：例如客户端面临断连重连、网络闪断、半包读写、失败缓存、网络拥塞和异常流的处理等等。

4) JDK NIO 的 Bug：例如臭名昭著的 Epoll Bug，它会导致 Selector 空轮询，最终导致 CPU 100%。直到 JDK 1.7 版本该问题仍旧存在，没有被根本解决

#### AIO

5、Java AIO(NIO.2) ： **异步非阻塞**，AIO 引入异步通道的概念，采用了 Proactor 模式，简化了程序编写，有效的请求才启动线程，它的特点是先由操作系统完成后才通知服务端程序启动线程去处理，一般适用于连接数较多且连接时间较长的应用

①、JDK 7 引入了 Asynchronous I/O，即 AIO。在进行 I/O 编程中，常用到两种模式：Reactor和 Proactor。Java 的 NIO 就是 Reactor，当有事件触发时，服务器端得到通知，进行相应的处理

②、AIO 即 NIO2.0，叫做异步不阻塞的 IO。AIO 引入异步通道的概念，采用了 Proactor 模式，简化了程序编写，有效的请求才启动线程，它的特点是先由操作系统完成后才通知服务端程序启动线程去处理，一般适用于连接数较多且连接时间较长的应用

③、目前 AIO 还没有广泛应用，Netty 也是基于NIO, 而不是AIO

### 线程模型

#### 传统阻塞I/O模型

![](/img/传统IO.png)

黄色的框表示对象， 蓝色的框表示线程，白色的框表示方法(API)。

**存在的问题：**1、当并发数很大，就会创建大量的线程，占用很大系统资源

2、连接创建后，如果当前线程暂时没有数据可读，该线程会阻塞在read 操作，造成线程资源浪费

#### Reactor

主要针对传统2个缺点：基于 I/O 复用模型、基于线程池复用线程资源

**Reactor单线程**

![](/img/Reactor单线程.png)

**优缺点：**

1)**优点：** 模型简单，没有多线程、进程通信、竞争的问题，全部都在一个线程中完成

2)**缺点：**性能问题，只有一个线程，无法完全发挥多核 CPU 的性能。Handler 在处理某个连接上的业务时，整个进程无法处理其他连接事件，很容易导致性能瓶颈

3)**缺点：**可靠性问题，线程意外终止，或者进入死循环，会导致整个系统通信模块不可用，不能接收和处理外部消息，造成节点故障

4)**使用场景：**客户端的数量有限，业务处理非常快速，比如 Redis在业务处理的时间复杂度 O(1) 的情况

**Reactor多线程**

![](/img/Reactor多线程.png)

**优缺点**

1)**优点：**可以充分的利用多核cpu 的处理能力

2)**缺点：**多线程数据共享和访问比较复杂， reactor 处理所有的事件的监听和响应，在单线程运行， 在高并发场景容易出现性能瓶颈.

**Reactor主从模型**

主从Reactor多线程：多个acceptor的NIO线程池用于接受客户端的连接

![](/img/Reactor主从模型.png)

**优缺点**

1)**优点：**父线程与子线程的数据交互简单职责明确，父线程只需要接收新连接，子线程完成后续的业务处理。

2)**优点：**父线程与子线程的数据交互简单，Reactor 主线程只需要把新连接传给子线程，子线程无需返回数据。

3)**缺点：**编程复杂度较高

**结合实例：**这种模型在许多项目中广泛使用，包括 Nginx 主从 Reactor 多进程模型，Memcached 主从多线程，Netty 主从多线程模型的支持

#### 种模式用生活案例来理解

1)单 Reactor 单线程，前台接待员和服务员是同一个人，全程为顾客服

2)单 Reactor 多线程，1 个前台接待员，多个服务员，接待员只负责接待

3)主从 Reactor 多线程，多个前台接待员，多个服务生

### Netty介绍

Netty是一个异步的、基于事件驱动的网络应用框架，用以快速开发高性能、高可靠性的网络 IO 程序。

Netty主要针对在TCP协议下，面向Clients端的高并发应用，或者Peer-to-Peer场景下的大量数据持续传输的应用。

Netty本质是一个NIO框架，适用于服务器通讯相关的多种应用场景

**优点：** 并发高 - NIO（非阻塞IO）、传输快-零拷贝

### Netty 的零拷贝

#### 传统意义的拷贝

在发送数据的时候，传统的实现方式是：

File.read(bytes)；Socket.send(bytes)  
这种方式需要四次数据拷贝和四次上下文切换：

1. 数据从磁盘读取到内核的read buffer
2. 数据从内核缓冲区拷贝到用户缓冲区
3. 数据从用户缓冲区拷贝到内核的socket buffer
4. 数据从内核的socket buffer拷贝到网卡接口（硬件）的缓冲区

#### 零拷贝的概念

明显上面的第二步和第三步是没有必要的，通过java的FileChannel.transferTo方法，可以避免上面两次多余的拷贝（当然这需要底层操作系统支持）

1. 调用transferTo,数据从文件由DMA引擎拷贝到内核read buffer
2. 接着DMA从内核read buffer将数据拷贝到网卡接口buffer

上面的两次操作都不需要CPU参与，所以就达到了零拷贝。

#### Netty中的零拷贝

主要体现在三个方面：

**1、bytebuffer**

Netty发送和接收消息主要使用bytebuffer，bytebuffer使用堆外内存（DirectMemory）直接进行Socket读写。

原因：如果使用传统的堆内存进行Socket读写，JVM会将堆内存buffer拷贝一份到直接内存中然后再写入socket，多了一次缓冲区的内存拷贝。DirectMemory中可以直接通过DMA发送到网卡接口

**2、Composite Buffers**

传统的ByteBuffer，如果需要将两个ByteBuffer中的数据组合到一起，我们需要首先创建一个size=size1+size2大小的新的数组，然后将两个数组中的数据拷贝到新的数组中。但是使用Netty提供的组合ByteBuf，就可以避免这样的操作，因为CompositeByteBuf并没有真正将多个Buffer组合起来，而是保存了它们的引用，从而避免了数据的拷贝，实现了零拷贝。

**3、对于FileChannel.transferTo的使用**

Netty中使用了FileChannel的transferTo方法，该方法依赖于操作系统实现零拷贝。

### Netty工作原理示意图

![](/img/Netty工作.png)

1、Netty抽象出两组线程池 BossGroup 专门负责接收客户端的连接, WorkerGroup 专门负责网络的读写

2、BossGroup 和 WorkerGroup 类型都是 NioEventLoopGroup

3、NioEventLoopGroup 相当于一个事件循环组, 这个组中含有多个事件循环 ，每一个事件循环是 NioEventLoop

4、NioEventLoop 表示一个不断循环的执行处理任务的线程， 每个NioEventLoop 都有一个selector , 用于监听绑定在其上的socket的网络通讯

5、NioEventLoopGroup 可以有多个线程, 即可以含有多个NioEventLoop

6、每个Boss NioEventLoop 循环执行的步骤有3步

1).轮询accept 事件

2).处理accept 事件 , 与client建立连接 , 生成NioScocketChannel , 并将其注册到某个worker NIOEventLoop 上的 selector

3).处理任务队列的任务 ， 即 runAllTasks

7、每个 Worker NIOEventLoop 循环执行的步骤

1).轮询read, write 事件

2).处理i/o事件， 即read , write 事件，在对应NioScocketChannel 处理

3).处理任务队列的任务 ， 即 runAllTasks

8、 每个Worker NIOEventLoop 处理业务时，会使用pipeline(管道), pipeline 中包含了 channel , 即通过pipeline 可以获取到对应通道, 管道中维护了很多的 处理器

#### Netty执行流程

**服务端：**

![](/img/Netty服务端.png)

代码

```java
 public static void main(String[] args) throws InterruptedException {
     // 创建BossGroup和WorkerGoup两个线程组
     // bossGoup只是处理连接请求，真正和客户端业务处理，会交给workerGoup完成
     // 两个都是无限循环
     // bossGroup、workerGoup含有的子线程(NioEventLoop)个数默认微实际CPU核数*2
     EventLoopGroup bossGroup = new NioEventLoopGroup();
     EventLoopGroup workerGoup = new NioEventLoopGroup();
     //创建服务器端的启动对象，配置参数
     ServerBootstrap bootstrap = new ServerBootstrap();

     //使用链式编程来进行设置
     try{
         bootstrap.group(bossGroup, workerGoup) //设置两个线程组
             .channel(NioServerSocketChannel.class) //使用NioSocketChannel作为服务器的通道实现
             .option(ChannelOption.SO_BACKLOG, 128) // 设置线程队列得到连接个数
             .childOption(ChannelOption.SO_KEEPALIVE, true) // 设置保持活动连接状态
             .childHandler(new ChannelInitializer<SocketChannel>() { //创建一个通道测试对象，匿名对象
                 // 给pipeline设置处理器
                 @Override
                 protected void initChannel(SocketChannel ch) throws Exception {
                     ch.pipeline().addLast(new NettyServerHandler());
                 }
             }); // 给workerGoup的EventLoop对应的管道设置处理器
         System.out.println("。。。。服务器已启动。。。。");
         // 绑定一个端口并且同步，生成了一个ChannelFuture对象
         ChannelFuture cf = bootstrap.bind(6668).sync(); // 启动服务器并绑定端口
         // 对关闭通道进行监听
         cf.channel().closeFuture().sync();
     }finally {
         bossGroup.shutdownGracefully();
         workerGoup.shutdownGracefully();
     }
}
```

1、创建ServerBootStrap实例

2、设置并绑定Reactor线程池：EventLoopGroup，EventLoop就是处理所有注册到本线程的Selector上面的Channel

3、设置并绑定服务端的channel

4、创建处理网络事件的ChannelPipeline和handler，网络时间以流的形式在其中流转，handler完成多数的功能定制：比如编解码 SSl安全认证

5、绑定并启动监听端口

6、当轮训到准备就绪的channel后，由Reactor线程：NioEventLoop执行pipline中的方法，最终调度并执行channelHandler

**客户端：**

![](/img/Netty客户端.png)

代码

```java
public static void main(String[] args) throws Exception {
    // 客户端需要一个事件循环组
    EventLoopGroup group = new NioEventLoopGroup();

    try {
        // 创建客户端启动对象
        // 注意客户段使用的不是ServerBootstrap 而是bootstrap
        Bootstrap bootstrap = new Bootstrap();
        //设置相关参数
        bootstrap.group(group) // 设置线程组
            .channel(NioSocketChannel.class)  // 设置客户端通道的实现类（反射）
            .handler(new ChannelInitializer<SocketChannel>() {
                @Override
                protected void initChannel(SocketChannel ch) throws Exception {
                    ch.pipeline().addLast(new NettyClientHandler()); // 加入自己的处理器
                }
            });
        System.out.println("客户端 ok//");
        // 启动客户端去连接服务器端，关于ChannelFuture要分析，涉及到netty异步模型
        ChannelFuture channelFuture = bootstrap.connect("127.0.0.1", 6668).sync();
        // 给关闭通道进行监听
        channelFuture.channel().closeFuture().sync();
    } finally {
        group.shutdownGracefully();
    }
}
```

[参考链接 –掘金](https://juejin.cn/post/5bdaf8ea6fb9a0227b02275a)
