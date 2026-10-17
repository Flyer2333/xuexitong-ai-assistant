import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { themeAssetCode } from './theme-assets.mjs';
const root = resolve(import.meta.dirname, '..');
const {version} = JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
const header = `// ==UserScript==
// @name         超星学习通自动化脚本（支持接入各种主流AI模型api）
// @namespace    xuexitong-ai-assistant.public
// @version      ${version}
// @description  视频、文献与学习练习辅助；自配 AI API；不含任何密钥
// @supportURL   https://github.com/Flyer2333/xuexitong-ai-assistant/issues
// @match        https://*.chaoxing.com/*
// @match        https://chaoxing.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        unsafeWindow
// @connect      *
// ==/UserScript==

`;
const files = ['vendor/jquery-3.6.0.min.js','vendor/html2canvas-1.4.1.min.js','src/core.cjs','src/retry.cjs','src/dom.js','src/capture.js','src/documents.js','src/reading.js','src/page-tasks.js','src/interruptions.js','src/video-quiz.js','src/ai.js','src/theme.js','src/workflow.js','src/player.js'];
const content = header + '(() => { const module = undefined, exports = undefined, define = undefined;\n' + themeAssetCode() + files.map(path=>readFileSync(resolve(root,path),'utf8')).join('\n') + '\n})();\n';
mkdirSync(resolve(root,'dist'),{recursive:true});
writeFileSync(resolve(root,'dist/xuexitong-ai-assistant.user.js'),content);
console.log(`Built public userscript ${version}; no local configuration included.`);
