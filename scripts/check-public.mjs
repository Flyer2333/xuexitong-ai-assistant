import {readFileSync,readdirSync,statSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {themeAssetCode} from './theme-assets.mjs';
const root=resolve(import.meta.dirname,'..');
function walk(dir){return readdirSync(dir).flatMap(name=>{if(['.git','node_modules','artifacts','local'].includes(name))return [];const path=resolve(dir,name);return statSync(path).isDirectory()?walk(path):[path];});}
// These local working notes are excluded by package.mjs and the upload whitelist.
const paths=walk(root).filter(path=>!['TASK_PROGRESS.md','AGENTS.md'].includes(relative(root,path)));
for(const path of paths){
 const name=relative(root,path).replaceAll('\\','/');
 if(/bridge-token|\.log$|本机\.user\.js|hongya|虹芽|job-/.test(name))throw Error(`Private artifact path: ${name}`);
 if(!/\.(js|cjs|mjs|md|json|yml|txt)$/.test(name))continue;
 const raw=readFileSync(path,'utf8');
 // Exempt only the exact, hash-verified public theme asset block from the private PNG check.
 const text=name === 'dist/xuexitong-ai-assistant.user.js' ? raw.replace(themeAssetCode(),'') : raw;
 if(name !== 'scripts/check-public.mjs')assert(!/[A-Z]:[/\\](Users|Codex)[/\\]|XxtHongyaAsset|data:image\/png;base64,[A-Za-z0-9+/]{500}/.test(text),`Personal asset/path in ${name}`);
 assert(!/GM_setValue\(['"]xxt-codex-token['"],\s*['"][a-f0-9]{64}/.test(text),`Paired token in ${name}`);
 assert(!/sk-[A-Za-z0-9_-]{20,}/.test(text),`Possible key in ${name}`);
 if(/\.(js|cjs|mjs)$/.test(name))execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
}
const script=readFileSync(resolve(root,'dist/xuexitong-ai-assistant.user.js'),'utf8');
assert(script.includes(themeAssetCode()),'Stale theme assets');
for(const name of ['core.cjs','retry.cjs','dom.js','capture.js','documents.js','reading.js','page-tasks.js','interruptions.js','video-lines.js','video-quiz.js','models.cjs','ai.js','updates.cjs','theme.js','workflow.js','player.js'])assert(script.includes(readFileSync(resolve(root,'src',name),'utf8')),`Stale build: ${name}`);
const {version}=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
assert(script.includes(`@version      ${version}`));assert(script.includes('@connect      *'));
const release=JSON.parse(readFileSync(resolve(root,'src/release.json'),'utf8'));
assert.equal(release.version,version);assert.deepEqual(JSON.parse(readFileSync(resolve(root,'dist/release.json'),'utf8')),release);
const meta=readFileSync(resolve(root,'dist/xuexitong-ai-assistant.meta.js'),'utf8');assert.equal(meta,script.slice(0,script.indexOf('(() => {')));
assert(meta.includes('@updateURL    https://raw.githubusercontent.com/Flyer2333/xuexitong-ai-assistant/main/dist/xuexitong-ai-assistant.meta.js'));
console.log(`Public build checked: ${paths.length} files, source sync and JavaScript syntax; theme assets hash-verified; no known personal paths or paired credentials.`);
