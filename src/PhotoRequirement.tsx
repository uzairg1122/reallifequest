import {useAppText} from './parentLanguage';
import type {PhotoMode} from './proof';
export default function PhotoRequirement({name='photoMode',value,initialMode='optional',onChange,disabled=false,label='Photo proof'}:{name?:string;value?:PhotoMode;initialMode?:PhotoMode;onChange?:(mode:PhotoMode)=>void;disabled?:boolean;label?:string}){
 const translate=useAppText();
 return <label className="photo-requirement">{label}<select name={name} aria-label={label} value={value} defaultValue={value===undefined?initialMode:undefined} onChange={e=>onChange?.(e.target.value as PhotoMode)} disabled={disabled}><option value="optional">{translate("Optional — photo or no photo")}</option><option value="required">{translate("Required — one photo")}</option><option value="before_after">{translate("Before & after — both photos required")}</option></select><small>Before & after: take one picture before starting and another when the task is finished.</small></label>;
}
