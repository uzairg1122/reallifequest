export type PhotoMode='optional'|'required'|'before_after';
export function photoMode(task:{photoMode?:PhotoMode;photo?:boolean}):PhotoMode{return task.photoMode||(task.photo?'required':'optional');}
export function photoModeLabel(mode:PhotoMode){return mode==='before_after'?'Before & after photos':mode==='required'?'Photo required':'Photo optional';}
export function proofError(mode:PhotoMode,after?:string,before?:string):string{
 if(mode==='before_after'&&(!before||!after))return 'Add both a before and an after photo.';
 if(mode==='required'&&!after)return 'Add a photo before submitting this mission.';
 return '';
}
