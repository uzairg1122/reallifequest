import rewardArt from '../assets/parent-redesign/icons/rewards.png';
import {useAppText} from './parentLanguage';
import {useEffect,useState,type FormEvent} from 'react';
import {ChevronRight,Clock} from 'lucide-react';
import {api} from './api';
import {rewardPresentation} from './rewardPresentation';
export default function OnlineRewards({parent,coins,onChange}:{parent:boolean;coins:number;onChange:()=>Promise<void>}){
 const translate=useAppText();
 const [data,setData]=useState<Awaited<ReturnType<typeof api.rewards>>>({rewards:[],requests:[]}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [filter,setFilter]=useState('All Rewards'),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
 const refresh=()=>api.rewards().then(result=>{setData(result);setLoadError('');}).catch(e=>setLoadError(e.message)).finally(()=>setLoading(false));
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),10000);return()=>clearInterval(timer);},[]);
 async function action(fn:()=>Promise<unknown>){setBusy(true);setMessage('');try{await fn();await refresh();await onChange();setMessage(parent?'Saved.':'Request sent! Your parent will review it.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 function create(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);void action(()=>api.addReward({name:String(f.get('name')),cost:Number(f.get('cost')),description:String(f.get('description'))}));}
 if(!parent){
  const rewards=data.rewards.filter(r=>filter==='All Rewards'||rewardPresentation(r.name,r.description).category===filter);
  return <div className="online-rewards child-wallet">
   <h2 className="sr-only">My rewards wallet</h2>
   <div className="pills" aria-label="Reward categories">{['All Rewards','Screen Time','Treats','Goals'].map(f=><button key={f} aria-pressed={filter===f} className={filter===f?'active':''} onClick={()=>setFilter(f)}>{f}</button>)}</div>
   {loading&&<p role="status" className="caption">Opening your rewards…</p>}
   {loadError&&<div className="card"><p role="alert" className="form-error">{loadError}</p><button className="text-button" onClick={()=>void refresh()}>Try again</button></div>}
   {message&&<p role="status" className="wallet-message">{message}</p>}
   <div className="reward-list">{rewards.map(r=>{const waiting=data.requests.some(q=>q.reward_id===r.id&&q.status==='pending');const affordable=coins>=r.cost_coins;return <button key={r.id} className={`reward-row ${waiting?'reward-pending':''}`} disabled={busy||loading||!!loadError||!affordable||waiting} aria-label={`${waiting?'Waiting for parent:':'Ask for reward:'} ${r.name}, ${r.cost_coins} coins${!affordable?`, ${r.cost_coins-coins} more to go`:''}`} onClick={()=>void action(()=>api.requestReward(r.id))}>
    <span className="reward-icon" aria-hidden="true">{rewardPresentation(r.name,r.description).icon}</span><div><strong>{r.name}</strong><span className="coin-text">🪙 {Number(r.cost_coins).toLocaleString()} coins</span>{r.description&&<small>{r.description}</small>}{waiting?<small className="waiting-label">Waiting for parent</small>:!affordable?<small>{(r.cost_coins-coins).toLocaleString()} more to go</small>:<small>Ask for this reward</small>}</div>{waiting?<Clock size={19}/>:<ChevronRight size={22}/>}</button>;})}</div>
   {!loading&&!loadError&&!rewards.length&&<section className="wallet-empty"><span aria-hidden="true">🎁</span><h3>{data.rewards.length?'More treasures to discover':'Your rewards start here'}</h3><p>{data.rewards.length?'Try another category to see your rewards.':'Your parent can add treats and special rewards. Complete missions to save up your coins!'}</p><div className="empty-tip-card"><span className="tip-star" aria-hidden="true">🪙</span><span><strong>Savings Tip:</strong> Finish your daily morning and bedtime missions to build up coins for treats!</span></div>{data.rewards.length>0&&<button className="text-button" onClick={()=>setFilter('All Rewards')}>Show all rewards</button>}</section>}
   <p className="caption wallet-help">Choose a reward to ask your parent. Coins are spent only after approval.</p>
   {data.requests.length>0&&<section className="card reward-history"><h3>{translate("My reward requests")}</h3>{data.requests.map(r=><div className="assigned-mission" key={r.id}><span aria-hidden="true">{rewardPresentation(r.name).icon}</span><div><strong>{r.name}</strong><small>{r.cost_coins} coins</small></div><span className={`request-status ${r.status}`}>{r.status==='pending'?'Waiting':r.status==='approved'?'Approved':r.status==='rejected'?'Not now':r.status}</span></div>)}</section>}
  </div>;
 }
 return <div className="online-rewards parent-rewards">
 <section className="reward-vault-intro">
  <img src={rewardArt} width={76} height={76} alt=""/>
  <div><h2>{translate("Family rewards")}</h2><p>{translate("Create treats and approve reward requests.")}</p></div>
 </section>{message&&<p role="status">{message}</p>}{loadError&&<div role="alert"><p className="form-error">{loadError}</p><button className="text-button" onClick={()=>void refresh()}>Try again</button></div>}
 {parent&&<form className="card reward-create" onSubmit={create}><h3>{translate("Add a special reward")}</h3><label>{translate("Reward name")}<input name="name" required maxLength={160} placeholder="Weekend movie night"/></label><div className="reward-create-fields"><label>{translate("Coin cost")}<input name="cost" type="number" min="1" max="100000" required defaultValue="100"/></label><label>{translate("Details")}<textarea name="description" maxLength={500} rows={2}/></label></div><button className="button" disabled={busy}>{translate("Add reward")}</button></form>}
 <div className="reward-list">{data.rewards.map(r=><div className="reward-row" key={r.id}><span className="reward-icon">🎁</span><div><strong>{r.name}</strong><small>{r.description}</small><span className="coin-text">🪙 {r.cost_coins} coins</span>{!parent&&<button className="text-button" disabled={busy||coins<r.cost_coins||data.requests.some(q=>q.reward_id===r.id&&q.status==='pending')} onClick={()=>void action(()=>api.requestReward(r.id))}>{data.requests.some(q=>q.reward_id===r.id&&q.status==='pending')?'Waiting for parent':'Ask for this reward'}</button>}</div></div>)}</div>{!data.rewards.length&&<p className="caption">{parent?'Add your first family reward above.':'Your parent can add special rewards here.'}</p>}
 <section className="card"><h3>{parent?translate("Reward requests"):translate("My reward requests")}</h3>{data.requests.map(r=><div className="assigned-mission" key={r.id}><div><strong>{r.name}</strong><small>{parent?`${r.child_name} · `:''}{r.status} · {r.cost_coins} coins</small>{parent&&r.status==='pending'&&<div className="review-buttons"><button className="approve" disabled={busy} onClick={()=>void action(()=>api.reviewReward(r.id,true))}>Approve reward</button><button className="touchup" disabled={busy} onClick={()=>void action(()=>api.reviewReward(r.id,false))}>Not now</button></div>}</div></div>)}</section></div>;
}
