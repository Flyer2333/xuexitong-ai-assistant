import {createInterface} from 'node:readline';
const scenario=process.env.XXT_CATALOG_FIXTURE||'pages';
let initialized=false,acknowledged=false;
const row=(model,efforts)=>({model,displayName:model,defaultReasoningEffort:efforts[0],supportedReasoningEfforts:efforts.map(reasoningEffort=>({reasoningEffort})),inputModalities:['text','image']});
for await(const line of createInterface({input:process.stdin})){
 const message=JSON.parse(line);
 if(!['initialize','initialized','model/list'].includes(message.method)) process.exit(9);
 const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
 if(scenario==='timeout') continue;
 if(scenario==='exit') process.exit(3);
 if(message.method==='initialize'){initialized=true;send({id:message.id,result:{userAgent:'isolated fixture'}});}
 if(message.method==='initialized') acknowledged=true;
 if(message.method==='model/list'){
  if(!initialized||!acknowledged) process.exit(8);
  if(scenario==='error') send({id:message.id,error:{message:'fixture error'}});
  else if(scenario==='malformed') send({id:message.id,result:{data:null}});
  else if(scenario==='empty') send({id:message.id,result:{data:[],nextCursor:null}});
  else if(scenario==='cursor-loop') send({id:message.id,result:{data:[row('fixture-a',['medium'])],nextCursor:'repeat'}});
  else send({id:message.id,result:message.params.cursor?{data:[row('fixture-b',['low','high'])],nextCursor:null}:{data:[row('fixture-a',['medium','max'])],nextCursor:'page-2'}});
 }
}
