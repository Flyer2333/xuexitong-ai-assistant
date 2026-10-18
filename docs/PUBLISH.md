# 开发与发布指南

项目仓库：[Flyer2333/xuexitong-ai-assistant](https://github.com/Flyer2333/xuexitong-ai-assistant)。

本文供维护者和希望修改源码的用户使用。只想安装脚本，请阅读 [安装教程](INSTALL.md)。创建自己的派生仓库时，将示例中的 `YOUR_NAME`、仓库名和版本替换为实际值。

## 发布前检查

1. 阅读根目录 `NOTICE.md`。上游再分发许可尚待确认，公开再分发前需核对许可范围或取得授权。
2. 在干净的项目目录运行 `npm run build` 和 `npm test`。
3. 检查待提交文件，排除 `src/local/`、`.env`、日志、浏览器用户数据、Key、连接码和课程私有 URL。需要提交 `dist` 中的安装脚本；它不包含用户配置。
4. 如实写明测试范围：模拟测试通过不等于所有真实课程和服务商均已验证。不要承诺支持所有模型、永久免费或保证满分。

## 通过 GitHub 网页上传

1. 登录自己的 GitHub，右上角 **+ → New repository**。
2. Repository name 填 `xuexitong-ai-assistant`，描述可填“学习通学习助手与可配置 AI API”。未完成授权核对时先保持 Private。
3. 不需要在网页额外勾选生成 README、License，源码已经提供说明；不要随意给上游衍生文件套 MIT。
4. 创建后点 **Add file → Upload files**。解压本源码 ZIP，将项目内文件和目录拖进去，保留 `src`、`scripts`、`docs`、`tests`、`vendor`、`assets`、`dist` 的层级。不要把 ZIP 本身当源码上传。
5. 核对 `.gitignore` 和 `.github` 目录，包含自动检查配置及问题反馈模板。网页拖拽可能漏掉点开头的文件或目录，缺失时单独上传，或改用下方 Git 命令。
6. 填提交说明，提交。到 **Actions** 检查构建与测试为绿色。
7. 核对授权后在仓库 Settings 调整可见性；公开前再检查提交内容。

## 通过 Git 命令上传

在解压目录打开终端，逐条运行：

```sh
git init
git add .
git status --short
git diff --cached --stat
git commit -m "Prepare public AI assistant 1.0.7"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/xuexitong-ai-assistant.git
git push -u origin main
```

运行命令前，先在 GitHub 创建同名空仓库。登录可使用 GitHub 提供的方式、SSH 或凭据管理器，不要把访问令牌写进 remote URL。检查暂存区时发现私人文件，应先取消暂存，再继续提交。此方式同样需要确认上游许可。

## 设置安装链接

仓库上传后，打开 `dist/xuexitong-ai-assistant.user.js`，点击 **Raw**，复制真实地址。通常形如：

```text
https://raw.githubusercontent.com/YOUR_NAME/xuexitong-ai-assistant/main/dist/xuexitong-ai-assistant.user.js
```

将实际可访问的 Raw 地址放入 README 的安装入口，检查链接打开的是脚本代码。

## 发布 Release

1. 仓库 **Releases → Draft a new release**。
2. 创建标签 `v1.0.7`，标题“超星学习通自动化脚本（支持接入各种主流AI模型api） 1.0.7”。
3. 写明此次变化、支持的协议、测试范围、API 费用及来源许可情况。
4. 上传 `dist/xuexitong-ai-assistant.user.js` 作为可安装附件；源码由 GitHub 自动生成 ZIP。
5. 核对附件版本与标签一致，确认没有预填 Key，再发布。供用户安装的附件应为 `.user.js`；源码 ZIP 不能通过油猴的备份导入功能安装。

## 更新版本

修改 `src` 后，更新 `package.json`、`src/theme.js`、检查器版本断言和 CHANGELOG，再构建、测试并提交 dist，最后发布新 Release。保持 userscript 的 @name/@namespace 一致，让油猴能够识别同一个脚本。

当前未配置 `@updateURL/@downloadURL`，用户应手动检查并安装更新。若要配置自动更新，在构建脚本元数据中填写稳定的实际地址，并先验证更新来源。远端更新后的脚本仍有原有网络与存储权限，维护者应审查 PR 和发布文件。

## 开发环境与测试

开发需要 Node.js 20.11+；直接安装 `.user.js` 不需要 npm。构建和协议测试只使用 Node 内置模块：

```sh
npm run build
npm test
```

浏览器测试开发依赖用 `npm install` 安装，再 `npx playwright install chromium`。测试默认读取本项目安装的 Playwright；也可把 `XXT_PLAYWRIGHT_PATH` 指向已经安装的 Playwright 包目录，不要写入项目源码。

已安装 Chrome 时默认运行；要用 Playwright Chromium，把 `XXT_BROWSER_CHANNEL` 设为 `chromium`，测试会省略 channel 参数：

```sh
XXT_BROWSER_CHANNEL=chromium npm run test:browser
```

PowerShell 使用 `$env:XXT_BROWSER_CHANNEL = 'chromium'` 再执行命令。测试结果写入项目 `artifacts/`，该目录被 Git 忽略。默认测试使用模拟网站和模型，不需要真实 Key，也不会向真实课程提交答案；服务商账号与实际课程需要另外验证。

## 每次更新时维护说明

- 新增功能同时写入 README 最前面的“产品功能”和完整功能说明，讲清操作方式与限制。
- 在 README 最下面的“更新记录”时间表增加一行，填写日期、版本、更新类型和用户能感受到的具体变化；保留既有历史。
- CHANGELOG 与时间表保持一致，只写功能、行为变化和问题修复。
- 不把文档编辑过程、宣传文案增删、打包上传步骤、内部版本迁移或作者工作记录列为用户更新内容；这些信息留在本地任务进度中。
