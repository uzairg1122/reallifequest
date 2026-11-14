import {exportJson} from './exportJson';
import {Component,type ErrorInfo,type ReactNode} from 'react';
export default class AppErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(error:Error,_info:ErrorInfo){console.error('App screen could not render:',error.message)}
 render(){if(!this.state.failed)return this.props.children;
  return <main className="login-screen" style={{maxWidth:480,margin:'auto',padding:28}}><h1>Let’s get you back to your adventure</h1><p>This screen could not open. Your saved progress has not been deleted.</p><button className="button" onClick={()=>location.reload()}>Try again</button><button className="button secondary" onClick={()=>{
   const data={saved:localStorage.getItem('real_life_quest_state_v1_family'),backup:localStorage.getItem('rlq_state_recovery_backup_v1')};void exportJson('real-life-quest-recovery.json',data).catch(()=>alert('Could not export. Please contact support@nomolabs.pro.'));
  }}>Save a recovery copy</button><a href="mailto:support@nomolabs.pro">Contact support</a></main>;
 }
}
