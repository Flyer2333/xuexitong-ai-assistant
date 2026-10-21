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
 const personas={};
 for(const item of JSON.parse(readFileSync(resolve(root,'assets/personas/manifest.json'),'utf8'))){
  if(!/^[a-z]+$/.test(item.id)||item.file!==`assets/personas/${item.id}.webp`)throw Error('Invalid persona asset');
  const bytes=readFileSync(resolve(root,item.file));if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('Persona asset changed: '+item.id);
  personas[item.id]={...item,src:`data:image/webp;base64,${bytes.toString('base64')}`};
 }
 const icons={};
 for(const item of JSON.parse(readFileSync(resolve(root,'assets/model-icons/manifest.json'),'utf8')).icons){
  if(!/^[a-z]+$/.test(item.id)||item.file!==`assets/model-icons/${item.id}.svg`)throw Error('Invalid model icon');
  const bytes=readFileSync(resolve(root,item.file));if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('Model icon changed: '+item.id);
  let svg=bytes.toString('utf8');if(/<script|onload=|<foreignObject|(?:href|src)=["']https?:/i.test(svg))throw Error('Unexpected SVG content');
  svg=svg.replaceAll('currentColor','#f4f6fb');icons[item.id]=`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
 }
 return `const XxtThemeAssets = Object.freeze(${JSON.stringify(assets)});\nconst XxtPersonaAssets=Object.freeze(${JSON.stringify(personas)});\nconst XxtModelIcons=Object.freeze(${JSON.stringify(icons)});\nconst XxtGlassCss=${JSON.stringify(readFileSync(resolve(root,'src/glass.css'),'utf8'))};\n`;
}
