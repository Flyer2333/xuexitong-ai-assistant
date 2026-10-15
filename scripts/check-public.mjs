import {readFileSync,readdirSync,statSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
function walk(dir){return readdirSync(dir).flatMap(name=>{if(['.git','node_modules','artifacts','local'].includes(name))return [];const path=resolve(dir,name);return statSync(path).isDirectory()?walk(path):[path];});}
const paths=walk(root);
for(const path of paths){
 const name=relative(root,path).replaceAll('\\','/');
 if(/bridge-token|\.log$|本机\.user\.js|hongya|虹芽|job-/.test(name))throw Error(`Private artifact path: ${name}`);
 if(!/\.(js|cjs|mjs|md|json|yml|txt)$/.test(name))continue;
 const text=readFileSync(path,'utf8');
 if(name !== 'scripts/check-public.mjs')assert(!/[A-Z]:[/\\](Users|Codex)[/\\]|XxtHongyaAsset|data:image\/png;base64,[A-Za-z0-9+/]{500}/.test(text),`Personal asset/path in ${name}`);
 assert(!/GM_setValue\(['"]xxt-codex-token['"],\s*['"][a-f0-9]{64}/.test(text),`Paired token in ${name}`);
 assert(!/sk-[A-Za-z0-9_-]{20,}/.test(text),`Possible key in ${name}`);
 if(/\.(js|cjs|mjs)$/.test(name))execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
}
const script=readFileSync(resolve(root,'dist/xuexitong-ai-assistant.user.js'),'utf8');
for(const name of ['core.cjs','dom.js','capture.js','documents.js','interruptions.js','video-quiz.js','ai.js','theme.js','workflow.js','player.js'])assert(script.includes(readFileSync(resolve(root,'src',name),'utf8')),`Stale build: ${name}`);
const {version}=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
assert(script.includes(`@version      ${version}`));assert(script.includes('@connect      *'));
console.log(`Public build checked: ${paths.length} files, source sync and JavaScript syntax; no known personal paths, embedded mascot or paired credentials.`);
