const fs=require('node:fs'),assert=require('node:assert/strict');
const args=process.argv.slice(2),output=args[args.indexOf('--output-last-message')+1];
assert.equal(args[args.indexOf('--model')+1],'gpt-6-luna');assert(args.includes('model_reasoning_effort="low"'));
const images=args.flatMap((value,i)=>value==='-i'?[args[i+1]]:[]);assert.equal(images.length,1);assert(fs.existsSync(images[0]));
assert.equal(fs.readFileSync(images[0]).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
fs.writeFileSync('fake-execution.json',JSON.stringify({pid:process.pid,model:'gpt-6-luna',reasoning:'low',images:images.length}));
let prompt='';process.stdin.on('data',chunk=>{prompt+=chunk;});process.stdin.on('end',()=>{
 const questions=JSON.parse(prompt.match(/题目数据：\n([\s\S]+?)\n图片映射/)[1]);
 setTimeout(()=>{
  fs.writeFileSync(output,JSON.stringify({answers:questions.map(q=>({id:q.id,choices:[],texts:['012345'],readable:true,confidence:Number(process.env.XXT_FAKE_CONFIDENCE||1),explanation:'isolated fake inference'}))}));
  fs.writeFileSync('fake-completed','done');
 },Number(process.env.XXT_FAKE_DELAY||0));
});
