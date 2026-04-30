![](../../../../assets/images/avatar/avatar.jpg)
<p align="center"   >大头镇楼</p>

---


::: danger
注意:该操作有风险,请谨慎使用。
:::
1. 打开sudoers文件
```bash
sudo visudo

#或者使用以下命令

sudo vim /etc/sudoers
```
这个命令会打开/etc/sudoers文件，这个文件是sudoers配置文件，里面有sudoers的配置信息，我们可以在这里添加我们自己的用户名，然后就可以使用sudo了。



2. 添加项目



在打开的文件中，找到如下一行：
```bash
root    ALL=(ALL:ALL) ALL
```
在其下添加一行：
```bash
USERNAME    ALL=(ALL:ALL) NOPASSWD:ALL
```

其中USERNAME替换成你自己的用户名



再找到以下一行：
```bash
%sudo ALL=(ALL:ALL) ALL
```
改为
```
%sudo ALL=(ALL:ALL) NOPASSWD:ALL
```
然后保存退出

注意:保存之前一定要确认没有输入错误，否则会导致sudo无法使用



这样就能免密使用sudo了