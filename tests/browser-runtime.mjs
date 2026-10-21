import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.XXT_PLAYWRIGHT_PATH || 'playwright');
function browserOptions(options={}){
 options={...options};
 const value=process.env.XXT_BROWSER_CHANNEL;
 if(value==='chromium')delete options.channel;else if(value)options.channel=value;
 return options;
}
const launch=chromium.launch.bind(chromium);
const persistent=chromium.launchPersistentContext.bind(chromium);
chromium.launch=options=>launch(browserOptions(options));
chromium.launchPersistentContext=(dir,options)=>{
 return persistent(dir,browserOptions(options));
};
export {chromium};
