# Ubuntu 免密使用 sudo

![示意图](../../../../assets/images/avatar/avatar.jpg){.pic-center}
<p align="center">大头镇楼</p>

::: danger
免密 sudo 会明显降低系统的操作门槛，也会同时降低误操作和提权后的防护门槛。

只建议在你完全信任的个人开发环境里使用，不建议在生产环境、多人共用机器、云服务器上直接全局开启。
:::

## 推荐做法

相比直接改 `/etc/sudoers`，更推荐把自定义规则单独写到 `/etc/sudoers.d/` 里：

1. 原文件更干净，后续排查更容易。
2. 出错时更容易回滚。
3. 不会把系统自带配置和自定义配置混在一起。

## 方案一：只给当前用户开启免密 sudo

这是更推荐的做法，影响范围最小。

### 1. 创建单独的 sudoers 配置文件

```bash
sudo visudo -f /etc/sudoers.d/99-nopasswd
```

### 2. 写入下面这一行

```bash
USERNAME ALL=(ALL:ALL) NOPASSWD:ALL
```

把 `USERNAME` 替换成你自己的用户名，比如：

```bash
icocoer ALL=(ALL:ALL) NOPASSWD:ALL
```

### 3. 保存退出后确认权限正确

通常 `visudo` 会自动处理语法检查，但你仍然可以再检查一下文件权限：

```bash
sudo chmod 440 /etc/sudoers.d/99-nopasswd
sudo ls -l /etc/sudoers.d/99-nopasswd
```

## 方案二：让整个 sudo 用户组都免密

这个方案影响更大，只有当你明确知道自己在做什么时再用。

### 1. 编辑 sudoers 主配置

```bash
sudo visudo
```

### 2. 找到下面这一行

```bash
%sudo ALL=(ALL:ALL) ALL
```

把它改成：

```bash
%sudo ALL=(ALL:ALL) NOPASSWD:ALL
```

这表示所有属于 `sudo` 组的用户以后执行 sudo 都不需要输入密码。

## 更稳一点的做法

如果你只是想让少数命令免密，不一定要直接放开全部 sudo。

比如只允许免密执行某几个命令：

```bash
USERNAME ALL=(ALL:ALL) NOPASSWD:/usr/bin/systemctl,/usr/bin/apt
```

这种方式通常比 `NOPASSWD:ALL` 更安全。

## 如何验证是否生效

执行下面这两条命令：

```bash
sudo -k
sudo -n true && echo "NOPASSWD 已生效"
```

说明：

1. `sudo -k` 会先清掉已有的 sudo 凭据缓存。
2. `sudo -n true` 会要求“禁止交互输入密码”执行一次 sudo。
3. 如果没有报错并输出提示，就说明免密配置已经生效。

## 出现问题怎么回滚

如果你是用的 `/etc/sudoers.d/99-nopasswd` 方案，回滚最简单：

```bash
sudo rm /etc/sudoers.d/99-nopasswd
```

如果你改的是 `/etc/sudoers`，就再执行一次：

```bash
sudo visudo
```

把：

```bash
%sudo ALL=(ALL:ALL) NOPASSWD:ALL
```

改回：

```bash
%sudo ALL=(ALL:ALL) ALL
```

## 常见问题

### 1. 保存时报语法错误

尽量使用 `visudo`，不要直接用普通编辑器裸改 `/etc/sudoers`。`visudo` 会在保存时帮你做语法检查。

### 2. 配置了还是要输密码

优先检查下面几项：

1. 用户名是不是写对了。
2. 文件权限是不是 `440`。
3. 规则有没有写到错误的文件里。
4. 你是不是只给单个用户配了规则，但当前登录的并不是那个用户。

### 3. 把 sudo 搞坏了怎么办

如果你还有 root 登录方式，先用 root 修复。

如果是桌面环境，也可以尝试切到恢复模式或者单用户模式再修。
