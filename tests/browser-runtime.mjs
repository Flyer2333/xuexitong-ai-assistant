import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.XXT_PLAYWRIGHT_PATH || 'playwright');
const launch=chromium.launchPersistentContext.bind(chromium);
chromium.launchPersistentContext=(dir,options={})=>{
 const value=process.env.XXT_BROWSER_CHANNEL;
 if(value==='chromium')delete options.channel;else if(value)options.channel=value;
 return launch(dir,options);
};
export {chromium};
