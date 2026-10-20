# 固定版本的字体解析依赖

本目录从 manifest.json 中列出的上游直接下载，构建前校验每个文件的 SHA-256。Typr.js 与 Typr.U.js 为 Photopea 的 MIT 代码，MD5 为 blueimp 2.19.0 的 MIT 代码，完整许可证随目录及构建保留。构建使用独立闭包，不向网页导出 Typr/md5；不执行可选 HarfBuzz 初始化、不在线拉取可执行依赖。字体字典在需要时按 src/fonts.js 的固定地址和哈希读取，不在此仓库重分发。
