# ubuntu启动时自动执行命令

---
最近在启动wsl时，发现启动时默认的路径时windows的用户目录，而不是wsl中的用户目录。

这里提供一个简单的修改方法。
1. 进入wsl
2. 进入用户目录
```bash
cd ~
```
3. 打开.bashrc文件
```bash
nano .bashrc
```
4. 把以下内容添加到文件末尾
```bash
cd ~
```
5. 保存退出
此时重启wsl时，应该会自动进入用户目录。

::: tip
WSL 启动后会读取 shell 的初始化文件，而 `~/.bashrc` 是 bash 交互式 shell 启动时默认加载的配置文件。把 `cd ~` 加入到这个文件末尾后，每次打开新的 WSL shell 时，都会先切换到当前用户的 home 目录。
:::
::: note
- 如果你使用的是 `bash` 以外的 shell（比如 `zsh`），应当把相应的命令写入 `~/.zshrc` 或对应 shell 的启动文件。
- `~/.bashrc` 只在非登录交互 shell 启动时执行，如果你想在所有 bash 启动场景下都进入用户目录，也可以把 `cd ~` 写进 `~/.bash_profile` 或 `~/.profile`。
- 这个方法只是让 shell 启动时进入用户目录，不会改变 WSL 默认挂载点或 Windows 工作目录。
:::
::: details
如果你希望更加稳定地控制 WSL 启动目录，可以在 Windows 端使用 WSL 配置文件 `\wsl$\...\etc\wsl.conf`，在其中设置 `defaultUser` 或使用 Windows 终端的启动配置指定 `startingDirectory`。但对于仅仅想让 shell 启动进入主目录的场景，直接修改 `~/.bashrc` 是最简单有效的方法。
:::
::: note
你可以在.bashrc 中可以追加大多可执行命令
:::