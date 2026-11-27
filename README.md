# GlassTube

仓库包含 GlassTube 的静态演示及 MyCraft B 站设备版。

| 入口 | 用途 |
| --- | --- |
| [index.html](index.html) | GlassTube 静态演示 |
| [bilibili.html](bilibili.html) | B 站静态原型 |
| [workbench/](workbench/) | 支持真实公开视频的 B 站设备版 |

运行新版需 Python 3：

```sh
cd workbench
python3 server.py --port 8975
```

打开 [http://127.0.0.1:8975](http://127.0.0.1:8975)。若端口已被 MyCraft 占用，可改用 18975。方向键移焦，Enter 确认，Esc 返回。首页访问时读取 B 站公开热门，可用「刷新热门」重新获取。「为你推荐」直接展示热门，主题按 B 站分区整理。播放页提供横向选集、相关推荐，以及播放器工具栏里的弹幕开关。公开播放、封面和弹幕依赖 B 站游客接口，字幕以实际可读轨道为准。账号授权未启用，离线仅支持本地样片。观看记录保存在当前浏览器。

GitHub Pages 可打开仓库根目录的静态原型。新版播放和搜索需要随仓库提供的本地服务。
