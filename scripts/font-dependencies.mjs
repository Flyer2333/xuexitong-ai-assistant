import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'../vendor/font');
export function fontDependenciesCode(){
 const files=JSON.parse(readFileSync(resolve(root,'manifest.json'),'utf8'));
 for(const item of files)if(createHash('sha256').update(readFileSync(resolve(root,item.file))).digest('hex')!==item.sha256)throw Error('Font dependency hash mismatch: '+item.file);
 const notices=files.filter(x=>x.file.endsWith('.txt')).map(x=>readFileSync(resolve(root,x.file),'utf8')).join('\n');
 const scripts=files.filter(x=>x.file.endsWith('.js')).map(x=>readFileSync(resolve(root,x.file),'utf8')).join('\n');
 return `/* Pinned upstream font dependencies.\n${notices}\n*/\nconst XxtFontDependencies=(function(define,module,exports){\n${scripts}\nreturn {Typr,md5:this.md5};\n}).call({});\n`;
}
