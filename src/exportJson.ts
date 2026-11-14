import {Capacitor,registerPlugin} from '@capacitor/core';
const nativeExport=registerPlugin<{exportJson:(input:{name:string;data:string})=>Promise<void>}>('QuestNavigation');
export async function exportJson(name:string,payload:unknown){
 const data=JSON.stringify(payload,null,2);
 if(Capacitor.getPlatform()==='android'){await nativeExport.exportJson({name,data});return;}
 const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
