---
title: "redis订阅python代码"
published: 2019-02-28
description: "def listen(self): for item in self.crawlseeds.listen(): if item'type' != 'message': continue meta = str(item'd…"
tags: ["Redis"]
category: "中间件"
draft: false
---

```python
class Listener(object):
    """
    监听器，用于监听Redis订阅的data
    """
    def __init__(self):
        # self.r = redis.Redis(host='139.198.4.56', port='6379')
        # redis_client为redis连接设置
        self.redis_client = redis_client
        self.crawl_seeds = self.redis_client.pubsub()
        self.crawl_seeds.subscribe('content')
        logging.info("连接到Redis...")
    
    def listen(self):
        for item in self.crawl_seeds.listen():
            if item['type'] != 'message':
                continue
            meta = str(item['data'], encoding='utf-8')
            logging.info('收:%s ' % json.loads(meta).get('content', '').strip())
```
用日志打印接受结果
