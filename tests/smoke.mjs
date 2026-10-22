import {spawnSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
// Reuse the platform-contract regressions; every request is fulfilled by fixtures.
const cases=['verify-rich-blanks.mjs','verify-two-checks.mjs','verify-grade-recovery.mjs','verify-quiet-hours.mjs','verify-notify-render.mjs','verify-audio-tasks.mjs'];
const results=[];
for(const file of cases){
 console.log(`\nSmoke: ${file}`);
 const started=Date.now();
 // Legacy-reproduction flags are deliberately excluded from the acceptance run.
 const env={...process.env};
 for(const key of ['XXT_LEGACY_BUNDLE','XXT_LEGACY_TWO_CHECKS','XXT_LEGACY_GRADE_BUNDLE','XXT_NOTIFY_BUNDLE','XXT_NOTIFY_OUTPUT','XXT_NOTIFY_BASELINE','XXT_AUDIO_BUNDLE','XXT_AUDIO_OUTPUT'])delete env[key];
 const result=spawnSync(process.execPath,[resolve(root,'tests',file)],{cwd:root,env,stdio:'inherit',timeout:180000});
 results.push({file,passed:result.status===0,error:result.error?.message,signal:result.signal,durationMs:Date.now()-started});
 if(result.status!==0)break;
}
const out=resolve(root,'output/playwright');await mkdir(out,{recursive:true});
// The existing CI artifact already includes smoke.json. Embed the audio evidence
// here so it is retained without a separate workflow or artifact-path change.
const audioEvidence=results.find(x=>x.file==='verify-audio-tasks.mjs'&&x.passed)
 ? JSON.parse(await readFile(resolve(out,'audio/observations.json'),'utf8')) : null;
await writeFile(resolve(out,'smoke.json'),JSON.stringify({scope:'Isolated browser pages and simulated models only',results,audioEvidence},null,2)+'\n');
if(results.length!==cases.length||results.some(x=>!x.passed))process.exitCode=1;
else console.log(`Smoke passed: ${results.length} browser regression groups.`);
