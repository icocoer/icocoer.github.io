# API 文档

## 字符串模块 `string`

### `truncate(str, maxLength, suffix?)`

将字符串截断到指定长度，超出部分用省略号（默认 `…`）代替。

**参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `str` | `string` | — | 原始字符串 |
| `maxLength` | `number` | — | 最大字符数 |
| `suffix` | `string` | `'…'` | 超出时追加的后缀 |

**示例**

```js
truncate('Hello World', 5);        // 'Hello…'
truncate('Hello World', 5, '...'); // 'Hello...'
```

---

### `camelToKebab(str)`

将驼峰命名转换为短横线命名。

```js
camelToKebab('myVariableName'); // 'my-variable-name'
```

---

## 日期模块 `date`

### `formatDate(date, pattern)`

格式化日期对象或时间戳。

**支持的占位符**

| 占位符 | 说明 |
|--------|------|
| `YYYY` | 四位年份 |
| `MM` | 两位月份 |
| `DD` | 两位日期 |
| `HH` | 两位小时（24 小时制） |
| `mm` | 两位分钟 |
| `ss` | 两位秒 |

**示例**

```js
formatDate(new Date('2025-06-01'), 'YYYY年MM月DD日'); // '2025年06月01日'
formatDate(1748736000000, 'YYYY-MM-DD HH:mm:ss');     // '2025-06-01 00:00:00'
```

---

## 数组模块 `array`

### `unique(arr)`

数组去重（支持基本类型）。

```js
unique([1, 2, 2, 3, 3]); // [1, 2, 3]
```

### `groupBy(arr, key)`

按对象属性分组。

```js
const users = [
  { name: 'Alice', role: 'admin' },
  { name: 'Bob',   role: 'user' },
  { name: 'Carol', role: 'admin' },
];

groupBy(users, 'role');
// { admin: [{...}, {...}], user: [{...}] }
```

---

## DOM 模块 `dom`

### `$(selector, context?)`

`document.querySelector` 的简写。

```js
$('#app');
$('.item', document.getElementById('list'));
```

### `on(el, event, handler)`

为元素绑定事件监听器，返回用于解绑的清理函数。

```js
const off = on(document, 'click', handler);
off(); // 解绑
```

---

> 📌 更多 API 持续补充中，欢迎提 Issue 或 PR。
