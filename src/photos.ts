export async function preparePhoto(file:File,edge=900):Promise<string>{
 if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('Choose a JPG, PNG or WebP photo.');
 if(file.size>20*1024*1024)throw Error('Choose a photo smaller than 20 MB.');
 const url=URL.createObjectURL(file);
 try{const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(Error('This photo could not be opened.'));img.src=url;});
  const scale=Math.min(1,edge/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d')!.drawImage(img,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.76);if(data.length>1500000)throw Error('Choose a smaller photo.');return data;
 }finally{URL.revokeObjectURL(url);}
}
