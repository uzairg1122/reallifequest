import {useLayoutEffect,useRef,useState} from 'react';

/** Retain a closing dialog briefly without retaining any previous screen or data tree. */
export function useAnimatedPresence<T>(requested:T|null, duration=140) {
  const [retained,setRetained]=useState<T|null>(requested);
  const [exiting,setExiting]=useState(false);
  const last=useRef(requested);
  useLayoutEffect(()=>{
    if(requested!==null){
      last.current=requested;setRetained(()=>requested);setExiting(false);
      return;
    }
    if(last.current===null)return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      last.current=null;setRetained(null);setExiting(false);return;
    }
    setExiting(true);
    const timer=setTimeout(()=>{last.current=null;setRetained(null);setExiting(false);},duration);
    return ()=>clearTimeout(timer);
  },[requested,duration]);
  return {value:requested??retained,exiting};
}
