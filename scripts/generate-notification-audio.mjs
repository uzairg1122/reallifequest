// Original short, gently decaying chimes; no downloaded/licensed audio samples.
import {mkdirSync,writeFileSync} from 'node:fs';
const folder=new URL('../android/app/src/main/res/raw/',import.meta.url);mkdirSync(folder,{recursive:true});
for(const [name,notes] of Object.entries({gentle:[660,880],bright:[784,988,1175],soft:[523,659]})){
 const rate=24000,duration=1.1,total=Math.round(rate*duration),bytes=Buffer.alloc(44+total*2);
 bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(total*2,40);
 for(let n=0;n<total;n++){const t=n/rate;let sample=0;notes.forEach((f,i)=>{const x=t-i*.16;if(x>=0)sample+=Math.sin(x*2*Math.PI*f)*Math.min(1,x/.015)*Math.exp(-x*7)*.23;});bytes.writeInt16LE(Math.round(Math.max(-.8,Math.min(.8,sample))*32767),44+n*2);}
 writeFileSync(new URL(`quest_${name}.wav`,folder),bytes);
}
