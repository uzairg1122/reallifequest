// Serialized by Playwright; fake vault data is test-only, never a production token.
export function mockNativeSession({image='',googleToken='fixture'}={}){
 window.androidBridge={};window.Capacitor={PluginHeaders:[{name:'SessionVault',methods:[{name:'get',rtype:'promise'},{name:'set',rtype:'promise'}]},{name:'ParentGoogleAuth',methods:[{name:'signIn',rtype:'promise'}]},{name:'Camera',methods:[{name:'getPhoto',rtype:'promise'}]}],nativePromise:async(plugin,method,input)=>{
  if(plugin==='SessionVault'){if(method==='get')return{value:localStorage.getItem('_mock_vault')||undefined};localStorage.setItem('_mock_vault',input.value);return{};}
  if(plugin==='Camera'){window.cameraOptions=input;return{webPath:image,format:'png'};}
  return{idToken:googleToken};
 }};
}
