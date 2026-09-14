---
title: "python的技巧和方法"
published: 2019-02-28
description: "l例如：获取当前文件路径。 os版： python print(os.path.dirname(file)) print(os.getcwd()) pathlib版： python print(pathlib.Path.…"
tags: ["python"]
category: "Python"
draft: false
---

# 1. 路径操作
比起os模块的path方法，python3标准库的pathlib模块的Path处理起路径更加的容易。

l例如：获取当前文件路径。
os版：
```python
print(os.path.dirname(__file__))
print(os.getcwd())
```
pathlib版：
```python
print(pathlib.Path.cwd())
```
看着好像没啥区别，然后看下面这个。
## 获取上两级文件目录
os版：
```python
print(os.path.dirname(os.path.dirname(os.getcwd())))
```
pathlib版:
```python
print(pathlib.Path.cwd().parent.parent)
```
## 拼接路径
os版:
```python
print(os.path.join(os.path.dirname(os.path.dirname(os.getcwd())),"yamls","a.yaml"))
```
pathlib版:
```python
parts=["yamls","a.yaml"]
print(pathlib.Path.cwd().parent.parent.joinpath(*parts))
```
## 运行时拼接路径
os版:
```python
os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'yamls',f'{site_name}.yaml')
```
pathlib版:
```python
parts=["yamls","a.yaml"]
print(pathlib.Path(__file__).resolve().parent.parent.joinpath(*parts))
```
另外pathlib生成的是个对象，在open文件操作中可以直接运行的但是如果当作字符串操作会出现错误，此时需要对其进行转换，使用os.fspath()即可，不过一般很少有操作路径字符串的习惯。
综合起来，还是pathlib拼接路径方便。

# 2. 保存标准格式的yaml文件
编程免不了要写配置文件，怎么写配置也是一门学问。
YAML 是专门用来写配置文件的语言，非常简洁和强大，远比 JSON 格式方便。
YAML在python语言中有PyYAML安装包。
前提安装第三方库
```python
pip install pyyaml
pip install ruamel.yaml
```
关于yaml的读取知识网上一堆了我就不说了，这里主要说写入。
```python
from ruamel import yaml
data={"age":23,"sex":"男","name":"牛皮"}
with open(conf_file, "w", encoding='utf-8') as fs:
    yaml.dump(data, fs, Dumper=yaml.RoundTripDumper, allow_unicode=True)
```
yaml写文件和json一样也是使用dump。

# 3. 同时迭代两个列表
以前的时候我是这么解决的
```python
a = ["a", "b", "c", "d"]
b = [1, 2, 3]  # 空的补充None
for index, a_item in enumerate(a):
    b_item = None
    if len(b) - 1 <= index:
        pass
    else:
        b_item = b[index]
    print({a_item:b_item})
```
现在通过itertools标准库的zip升级版zip_longest解决，可以通过fillvalue参数补充缺失值。当然如果比较的元素个数相同可以直接用zip。
```python
from itertools import zip_longest

a = ["a", "b", "c", "d","e"]
b = [1, 2, 3]  # 空的补充None
for a_item, b_item in zip_longest(a,b,fillvalue=0):
    print({a_item:b_item})
```
# 4. 三元表达式还能这么用？
一般的我们这样写
```python
a="hello" if 2>1 else "bye"
print(a)
```
我们知道python中false实际式0，true是1，所以对于上面的式子我们就可以这么写了。
```python
a=["hello","bye"][2<1]
print(a)
```
因为2<1是false也就是0，所以输出了第一个元素hello。

# 5.简单的类使用namedtuple代替
先来一个简单的例子
```python
import collections
# Person=collections.namedtuple('Person','name age')
# 如果使用python中的关键字会出现错误,此时使用rename字段。
# 按照元素在元组中的下标赋值。class就是_2,def是_3
Person = collections.namedtuple('Person', ['name', 'age', 'class', 'def', 'name', 'name'], rename=True)
p = Person(name='lisa', age='12', _2="class2", _3="def", _4="name2", _5="name3")
print(p)
# 如果出现相同的字段第二次出现的时候也是用其下标，参考上面的例子。
# _fields查看字段名,可以发现内置模块和重复的字段标记为_加下标的形式
print(p._fields)
# 使用_asdict将namedtuple转为OrderedDict。
od = p._asdict()
print(od)
# 然后可以转为字典
print(dict(od))
# _replace()方法构建一个新实例，因为namedtuple是不可变类型所以这个方法可以返回一个新的对象。
new_p = p._replace(name="samJ")
print(new_p)
print(new_p is p)  # 可以看到不是同一个对象。
```
一个实用的例子pyppeteer的例子感受下
```python
import asyncio
import pyppeteer
from collections import namedtuple

Response = namedtuple("rs", "title url html cookies headers history status")


async def get_html(url, timeout=30):
    # 默认30s
    browser = await pyppeteer.launch(headless=True, args=['--no-sandbox'])
    page = await  browser.newPage()
    res = await page.goto(url, options={'timeout': int(timeout * 1000)})
    data = await page.content()
    title = await page.title()
    resp_cookies = await page.cookies()
    resp_headers = res.headers
    resp_history = None
    resp_status = res.status
    response = Response(title=title, url=url,
                        html=data,
                        cookies=resp_cookies,
                        headers=resp_headers,
                        history=resp_history,
                        status=resp_status)
    return response


if __name__ == '__main__':
    url_list = ["http://www.10086.cn/index/tj/index_220_220.html", "http://www.10010.com/net5/011/",
                "http://python.jobbole.com/87541/"]
    task = (get_html(url) for url in url_list)

    loop = asyncio.get_event_loop()
    results = loop.run_until_complete(asyncio.gather(*task))
    for res in results:
        print(res.title)
```
# 6 使用枚举让数字变得更易懂。
```python
import enum


# 枚举
@enum.unique
class Sex(enum.Enum):
    man = 12
    woman = 13

    # 因为加了唯一值的装饰器所以下面添加属性会报错
    # boy=12


print(Sex.man.name)
print(Sex.woman.value)

# 遍历
for item in Sex:
    print(item.name)
    print(item.value)
print("-" * 40)
# 其他使用方式
words = enum.Enum(
    value='item',
    names=('a b c d e f'),
)
# 输出元素c，必须是上面names里含有的值
print(words.c)
print(words.f)
# 因为names不含有w所以报错
try:
    print(words.w)
except AttributeError as e:
    print(e.args)
print("-" * 40)
for word in words:
    print(word.name, word.value)  # 默认赋值为、从1开始自增。
print("-" * 40)
# 如果自定义元素的值啧改为一下元组的形式
words2 = enum.Enum(
    value='item2',
    names=[('a', 23), ('b', 56), ("c", 12), ("d", 333)]
)
for word2 in words2:
    print(word2.name, word2.value)
```
# 7 链式合并字典chainmap的使用
```python
from collections import ChainMap

# ChainMap

d1 = {'a': 1, 'b': 2}
d2 = {'a2': 3, 'b2': 4}
d3 = {'a3': 5, 'b3': 6}
d4 = {'a4': 7, 'b4': 8}
c = ChainMap(d1, d2, d3, d4)  # 多个字典合并为一个
for k, v in c.items():
    print(k, v)
print(c.maps)  # 要搜索的索引列表

c.maps = list(reversed(c.maps))  # 逆转映射列表
print(c)

# 因为c和d1-d4对应的索引位置实际是一个所以，修改c的时候会影响到d1到d4其中饿的一个值，同理修改
# d1-d4的时候也会影响到c。
# 所以使用new_child创建一个新的映射。再修改就影响不到底层的数据了。
c2 = c.new_child()
c2["a4"] = 100
print(c)
print(c2)
# 输出发现c的值没有发生变化，只要c2变化。
d5 = {"a5": 34, "b5": 78}
c2 = c2.new_child(d5)  # 可以在原来的映射基础上添加新的映射
print(c2)
```
# 8 在不打乱列表顺序的基础上插入元素
```python
import bisect

"""
bisect 模块，用于维护有序列表。
bisect 模块实现了一个算法用于插入元素到有序列表。
在一些情况下，这比反复排序列表或构造一个大的列表再排序的效率更高。
Bisect 是二分法的意思，这里使用二分法来排序，它会将一个元素插入到一个有序列表的合适位置，
这使得不需要每次调用 sort 的方式维护有序列表。
"""
values = [14, 85, 77, 26, 50, 45, 66, 79, 10, 3, 84, 77, 1]
print("New Pos Content")
print("--- --- -------")
l = []
for i in values:
    postion = bisect.bisect(l, i)  # 返回插入的位置
    bisect.insort(l, i)  # 等于insort_right
    print('{:3}{:3}'.format(i, postion), l)

"""
Bisect模块提供的函数有：

bisect.bisect_left(a,x, lo=0, hi=len(a)) :
查找在有序列表 a 中插入 x 的index。lo 和 hi 用于指定列表的区间，默认是使用整个列表。如果 x 已经存在，在其左边插入。返回值为 index。

bisect.bisect_right(a,x, lo=0, hi=len(a))
bisect.bisect(a, x,lo=0, hi=len(a)) ：
这2个函数和 bisect_left 类似，但如果 x 已经存在，在其右边插入。

bisect.insort_left(a,x, lo=0, hi=len(a)) ：
在有序列表 a 中插入 x。和 a.insert(bisect.bisect_left(a,x, lo, hi), x) 的效果相同。

bisect.insort_right(a,x, lo=0, hi=len(a))
bisect.insort(a, x,lo=0, hi=len(a)) :
和 insort_left 类似，但如果 x 已经存在，在其右边插入。

Bisect 模块提供的函数可以分两类： bisect* 只用于查找 index， 不进行实际的插入；
而 insort* 则用于实际插入。该模块比较典型的应用是计算分数等级：
"""
```
# 9 关于字典的逻辑运算你了解多少
```python
# 使用&操作符查看字典的相同之处
#字典键支持常见的集合操作，并集交集差集。
a = {'x': 1, 'y': 2, 'z': 3}
b = {'w': 2, 'z': 4, 'x': 3, 'z': 3}

# 获取相同的键
c = a.keys() & b.keys()
print(c)
# 获取相同的键值对
d = a.items() & b.items()
print(d)
# 创建一个新的字典并删除某些键

e = {k: a[k] for k in a.keys() - {'z', 'x'}}
print(e)
```
# 10 给切片起个名字
```python
a="safr3.14"
print(a[-4:])
#上面可以改为
pie = slice(len(a)-4, len(a))
print(a[pie])   # 和 a[-4:] 等价，但切片有了名字，可复用、可读
```
# 11 获取出现频率高的元素
```python
from collections import Counter

text = "abcdfegtehto;grgtgjri"  # 可迭代对象
lis = ["a", "c", "d", "t", "b"]
dic = {"a": 1, "b": 4, "c": 2, "d": 9}  # 字典也可以
c = Counter()  # 可以定义空容器然后update
c.update(text)
c2 = Counter()
c2.update(dic)

c3 = Counter(lis)  # 也可以直接传入对象
print(c)
print(c2)
print(c3)

# 使用c.most_common(n)获取前n出现频率最高的元素,列表元组类型
print(c.most_common(4))
```
