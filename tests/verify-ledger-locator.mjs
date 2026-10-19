import {chromium} from './browser-runtime.mjs';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const bundle=await readFile(new URL('../dist/xuexitong-ai-assistant.user.js',import.meta.url),'utf8');const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<div id="coursetree"><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name">甲</span></div><div class="posCatalog_select"><span class="posCatalog_name">乙</span><a href="/mycourse/studentstudy?courseId=fixture&clazzid=c&cpi=account&chapterId=2">乙</a></div></div>'}));
 await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=fixture&clazzid=c&cpi=account');await page.evaluate(()=>{
  window.unsafeWindow=window;window.__gm={'xxt-ai-enabled':false,'xxt-quiet-enabled':false};window.__clicks=[];window.GM_getValue=(k,d)=>__gm[k]??d;window.GM_setValue=(k,v)=>__gm[k]=structuredClone(v);window.GM_xmlhttpRequest=()=>{throw Error('unexpected model call');};
  const key=`xxt-skipped:xxt-auto:${location.origin}/fixture/c`,scope=`xxt-auto:${location.origin}/fixture/c/account`;
  __gm[key]=[{scope,index:1,title:'乙',chapter:'乙',reason:'未识别',status:'pending',at:1},{scope,index:0,title:'甲',chapter:'甲',reason:'提交后状态未知',uncertainSubmission:true}];
  for(const node of document.querySelectorAll('.posCatalog_select'))node.onclick=()=>{__clicks.push(node.querySelector('span').textContent);document.querySelector('.posCatalog_active').classList.remove('posCatalog_active');node.classList.add('posCatalog_active');};
 });await page.addScriptTag({content:bundle});await page.locator('[data-skipped-log] summary').click();await page.locator('[data-retry-pending]').click();try{await page.waitForFunction(()=>__clicks.length===1,null,{timeout:5000});}catch(error){console.error(await page.evaluate(()=>({status:document.querySelector('pre')?.textContent,url:location.href,gm:JSON.stringify(__gm),catalog:XxtLocator.create().catalog(document.querySelector('#coursetree')).map(x=>({index:x.index,title:x.title})),clicks:__clicks})));throw error;}assert.deepEqual(await page.evaluate(()=>__clicks),['乙']);
 await page.locator('[data-action=stop]').click();await page.waitForTimeout(500);assert.deepEqual(await page.evaluate(()=>__clicks),['乙']);
 let resourceFetches=0;await page.route('https://unexpected.invalid/**',r=>{resourceFetches++;return r.abort();});
 const result=await page.evaluate(async()=>{
  let calls=0;const fetcher=async()=>{calls++;return new Response('<script>window.__executed=true</script><div class="prev_ul"><li>card</li></div><iframe src="https://unexpected.invalid/frame"></iframe><img src="https://unexpected.invalid/image.png">',{headers:{'content-type':'text/html'}});};
  const locator=XxtLocator.create({fetcher}),entries=locator.catalog(document.querySelector('#coursetree'));
  const first=await Promise.all([locator.prefetch(entries,location.href),locator.prefetch(entries,location.href)]);await locator.prefetch(entries,location.href);
  const invalid=locator.safeUrl('https://other.invalid/mycourse/studentstudy?courseId=fixture',location.href);
  const account=locator.safeUrl('/mycourse/studentstudy?courseId=fixture&clazzid=c&cpi=other',location.href);
  document.querySelector('.posCatalog_name').textContent='目录变化';await new Promise(r=>setTimeout(r,0));const changed=locator.catalog(document.querySelector('#coursetree'))[0].title;locator.close();
  return{calls,first,invalid,account,changed,executed:!!window.__executed};
 });assert.equal(result.calls,1);assert.equal(result.first[0][0].cards,1);assert.equal(result.first[0][0].frames,1);assert.equal(result.invalid,null);assert.equal(result.account,null);assert.equal(result.changed,'目录变化');assert.equal(result.executed,false);
 await page.waitForTimeout(200);assert.equal(resourceFetches,0);
 console.log('Central retry selects scoped pending chapter, excludes uncertain submission, respects manual stop; locator dedup/TTL cache, mutation invalidation, same-course/account URL bounds and inert parsing without resource loads passed. Synthetic course only.');
}finally{await browser.close();}
