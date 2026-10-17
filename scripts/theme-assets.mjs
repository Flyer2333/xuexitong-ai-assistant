import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
export function themeAssetCode(){
 const manifest=JSON.parse(readFileSync(resolve(root,'assets/themes/manifest.json'),'utf8'));
 const assets={};
 for(const item of manifest){
  if(!['nailoong','naiwa'].includes(item.id)||!/^assets\/themes\/[a-z]+\.(png|gif)$/.test(item.file))throw Error('Invalid theme asset');
  const bytes=readFileSync(resolve(root,item.file));
  if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('Theme asset changed: '+item.id);
  assets[item.id]=`data:${item.mime};base64,${bytes.toString('base64')}`;
 }
 return `const XxtThemeAssets = Object.freeze(${JSON.stringify(assets)});\n`;
}
