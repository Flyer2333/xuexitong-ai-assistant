import {readdirSync,readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
const {version}=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
const roots=['src','vendor','assets','tests','scripts','docs','dist','.github','README.md','NOTICE.md','CHANGELOG.md','package.json','.gitignore'];
function walk(path){return statSync(path).isDirectory()?readdirSync(path).filter(name=>!['local','node_modules','artifacts'].includes(name)).flatMap(name=>walk(resolve(path,name))):[path];}
const files=roots.flatMap(name=>walk(resolve(root,name))).sort();
let offset=0;const local=[],central=[],records=[];
for(const path of files){
 const name=Buffer.from('xuexitong-ai-assistant/'+relative(root,path).replaceAll('\\','/'),'utf8'),data=readFileSync(path),packed=deflateRawSync(data);
 let crc=0xffffffff;for(const byte of data){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
 const h=Buffer.alloc(30),c=Buffer.alloc(46);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(8,8);h.writeUInt16LE(0x21,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(packed.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(name.length,26);
 c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt16LE(0x21,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);
 local.push(h,name,packed);central.push(c,name);records.push({name:name.toString(),offset,bytes:data});offset+=h.length+name.length+packed.length;
}
const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
const zip=Buffer.concat([...local,cd,end]);
for(const record of records){const n=zip.readUInt16LE(record.offset+26),start=record.offset+30+n,size=zip.readUInt32LE(record.offset+18);if(!inflateRawSync(zip.subarray(start,start+size)).equals(record.bytes))throw Error('ZIP verification failed');if(/\/local\/|\.log$|token.*\.txt|本机\.user/.test(record.name))throw Error('Private file in ZIP');}
mkdirSync(resolve(root,'artifacts'),{recursive:true});const out=resolve(root,`artifacts/xuexitong-ai-assistant-${version}-source.zip`);writeFileSync(out,zip);
const hash=createHash('sha256').update(zip).digest('hex');writeFileSync(out+'.sha256',hash+'  '+out.split(/[\\/]/).pop()+'\n');
console.log(`Source ZIP verified: ${records.length} files. SHA256 ${hash}`);
