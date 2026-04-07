# 快速上手

本页介绍如何将工具库引入你的项目。

## 安装

### npm

```bash
npm install @icocoer/utils
```

### yarn

```bash
yarn add @icocoer/utils
```

### CDN（浏览器直接引用）

```html
<script src="https://cdn.jsdelivr.net/npm/@icocoer/utils/dist/index.min.js"></script>
```

---

## 第一个示例

```js
import { formatDate, truncate } from '@icocoer/utils';

// 格式化日期
console.log(formatDate(new Date(), 'YYYY-MM-DD')); // 2025-06-01

// 截断字符串
console.log(truncate('这是一段很长的文字', 6)); // 这是一段…
```

---

## 环境要求

- Node.js >= 16
- 浏览器：现代浏览器（Chrome / Firefox / Safari / Edge）

---

## 下一步

- 查看 [API 文档](docs/api.md) 了解所有可用函数
- 查看 [更新日志](docs/changelog.md) 了解版本变化
