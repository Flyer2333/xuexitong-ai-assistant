import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const root=new URL('..',import.meta.url),results=[];
const {version}=JSON.parse(readFileSync(new URL('package.json',root),'utf8'));
const tests=[['tests/verify-ui-release.mjs'],['tests/verify-text-routing.mjs'],['tests/verify-routing.mjs'],['tests/verify-text-controls.mjs'],['tests/verify-text-workflow.mjs'],['tests/verify-ledger-locator.mjs'],
 ['tests/public-browser.mjs'],['tests/verify-image-questions.mjs'],['tests/verify-page-tasks.mjs'],['tests/verify-no-ai-mode.mjs'],['tests/verify-page-tasks.mjs','--no-ai'],
 ['tests/verify-quiet-hours.mjs'],['tests/verify-model-picker.mjs'],['tests/verify-themes.mjs'],['tests/verify-video-quiz-context.mjs'],
 ['tests/verify-video-submission-recovery.mjs'],['tests/verify-nested-check-recovery.mjs'],['tests/verify-late-video-popup.mjs']];
for(const args of tests){console.log('VERIFY',args.join(' '));const start=Date.now();const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env});
 results.push({test:args.join(' '),status:result.status,elapsedMs:Date.now()-start});mkdirSync(new URL('artifacts',root),{recursive:true});
 writeFileSync(new URL(`artifacts/verification-${version}.json`,root),JSON.stringify({version,synthetic:true,results},null,2)+'\n');
 if(result.status!==0)process.exit(result.status||1);
}
console.log('All routing-release browser regressions passed. These use synthetic sites/model replies, not live-course acceptance.');
