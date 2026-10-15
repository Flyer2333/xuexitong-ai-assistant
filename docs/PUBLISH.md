# 上传 GitHub 与发布教程

维护仓库为 [Flyer2333/xuexitong-ai-assistant](https://github.com/Flyer2333/xuexitong-ai-assistant)。本教程供后续维护或创建自己的派生仓库，示例中的 `YOUR_NAME`、仓库名和版本应改成你自己的值。公开源码不包含已登录凭据。

## 0. 发布前核对

1. 阅读根目录 `NOTICE.md`，核对上游授权后再公开再分发。这是目前未解决的发布前事项。
2. 在干净目录运行 `npm run build`、`npm test`。
3. 确认没有 `src/local/`、`.env`、日志、浏览器 profile、Key、连接码或课程私有 URL。`dist` 是应提交的通用安装文件，不含配置。
4. 仓库说明应保留“协议模拟验证、尚未逐厂商/真实课程实测”的边界，不写成“支持所有模型/永久免费/保证满分”。

## 1. 方式 A：不使用 Git 命令

1. 登录自己的 GitHub，右上角 **+ → New repository**。
2. Repository name 填 `xuexitong-ai-assistant`，描述可填“学习通学习助手与可配置 AI API”。未完成授权核对时先保持 Private。
3. 不需要在网页额外勾选生成 README、License，源码已经提供说明；不要随意给上游衍生文件套 MIT。
4. 创建后点 **Add file → Upload files**。解压本源码 ZIP，将项目内文件和目录拖进去，保留 `src`、`scripts`、`docs`、`tests`、`vendor`、`dist` 的层级。不要把 ZIP 本身当源码上传。
5. 网页拖拽可能漏掉点开头的文件；核对 `.gitignore` 和 `.github/workflows/check.yml`，必要时单独上传或用方式 B。
6. 填提交说明，提交。到 **Actions** 检查构建与测试为绿色。
7. 核对授权后在仓库 Settings 调整可见性；公开前再检查提交内容。

## 2. 方式 B：使用 Git

在解压目录打开终端，逐条运行：

```sh
git init
git add .
git status --short
git diff --cached --stat
git commit -m "Prepare public AI assistant 1.0.1"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/xuexitong-ai-assistant.git
git push -u origin main
```

先在 GitHub 创建同名空仓库；使用 GitHub 自己提供的登录/SSH 或凭据管理器，不把访问令牌写进 remote URL。`git add .` 后发现私人文件时先取消暂存，不要推送。首次发布前的许可核对同方式 A。

## 3. 提供安装链接

仓库上传后，打开 `dist/xuexitong-ai-assistant.user.js`，点击 **Raw**，复制真实地址。通常形如：

```text
https://raw.githubusercontent.com/YOUR_NAME/xuexitong-ai-assistant/main/dist/xuexitong-ai-assistant.user.js
```

把真实链接放到 README 的快速开始里。不要在没有实际仓库之前伪造可用下载链接。

## 4. 发布 Release

1. 仓库 **Releases → Draft a new release**。
2. 创建标签 `v1.0.1`，标题“超星学习通自动化脚本（支持接入各种主流AI模型api） 1.0.1”。
3. 说明支持的协议、界面变化、测试范围、API 费用与来源授权状态。
4. 上传 `dist/xuexitong-ai-assistant.user.js` 作为可安装附件；源码由 GitHub 自动生成 ZIP。
5. 再次检查附件不是旧本机版、没有预填 Key，然后发布。源码包不能导入油猴 ZIP 备份功能，安装附件应是 `.user.js`。

## 5. 后续更新

修改 `src` → 同步 `package.json`、`src/theme.js`、检查器版本断言与 CHANGELOG → 构建测试 → 提交 dist → 发新 Release。保持 userscript 的 @name/@namespace，油猴才能正确识别同一个公开脚本。

当前没有写 `@updateURL/@downloadURL`，安装后的自动更新行为不作保证。拥有稳定仓库 URL 后，可在构建脚本元数据中填你自己的实际地址；先验证更新来源，再让使用者启用。任何远端脚本更新都继承油猴网络与存储权限，应审查 PR 和发布产物。

## 6. 本地开发与浏览器回归

Node.js 20.11+，生产安装不需要 npm。协议测试只依赖 Node 内置模块：

```sh
npm run build
npm test
```

浏览器测试开发依赖用 `npm install` 安装，再 `npx playwright install chromium`。测试默认读取本项目安装的 Playwright；也可把 `XXT_PLAYWRIGHT_PATH` 指向已经安装的 Playwright 包目录，不要写入项目源码。

已安装 Chrome 时默认运行；要用 Playwright Chromium，把 `XXT_BROWSER_CHANNEL` 设为 `chromium`，测试会省略 channel 参数：

```sh
XXT_BROWSER_CHANNEL=chromium npm run test:browser
```

PowerShell 使用 `$env:XXT_BROWSER_CHANNEL = 'chromium'` 再执行命令。测试资料写入项目 `artifacts/`，被 Git 忽略。所有默认测试只使用模拟网站/模型，不需要真实 Key，不会帮你验证付费账号或自动向真实课程提交。
