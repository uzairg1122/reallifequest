import {Capacitor,registerPlugin} from '@capacitor/core';
import {useEffect,useState} from 'react';
import {api,getApiToken,type FamilyPlan} from './api';

type PlayPlan = {id:string;price:string};
type Purchases = {tokens:string[];pending:boolean};
const billing = registerPlugin<{
 plans():Promise<{plans:PlayPlan[]}>;
 buy(input:{planId:string;accountId:string}):Promise<Purchases>;
 restore():Promise<Purchases>;
}>('FamilyBilling');

export default function FamilyBilling({plan,onPlan}:{plan:FamilyPlan;onPlan:(plan:FamilyPlan)=>void}) {
 const [plans,setPlans]=useState<PlayPlan[]>([]);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const native=Capacitor.getPlatform()==='android';
 const manage='https://play.google.com/store/account/subscriptions?sku=family_access&package=com.reallifequest.app';
 useEffect(()=>{
  if(!native||!plan.canPurchase||plan.active)return;
  let mounted=true;
  billing.plans().then(result=>{if(mounted)setPlans(result.plans);}).catch(error=>{if(mounted)setMessage(error.message);});
  return ()=>{mounted=false;};
 },[native,plan.canPurchase,plan.active]);
 async function purchase(id?:string) {
  setBusy(true);setMessage('');
  const session=getApiToken();
  try {
   const result=id?await billing.buy({planId:id,accountId:plan.accountId}):await billing.restore();
   if(getApiToken()!==session)return;
   let failure:unknown;
   for(const token of result.tokens){
    if(getApiToken()!==session)return;
    try {
     const {plan:updated}=await api.verifyPurchase(token);
     if(getApiToken()===session)onPlan(updated);
     return;
    }catch(error){failure=error;}
   }
   if(failure)throw failure;
   setMessage(result.pending?'Payment is pending. Once it completes, tap Restore purchase.':'No active purchase was found on this Google Play account.');
  }catch(error){setMessage(error instanceof Error?error.message:'Google Play could not finish the purchase.');}
  finally{setBusy(false);}
 }
 return <section className="card family-billing">
  <h2>{plan.active?'Family plan':'Continue your family adventure'}</h2>
  <p>{plan.paid?'Your family subscription is active.':plan.active&&plan.trialEndsAt?`Your free trial ends on ${new Date(plan.trialEndsAt).toLocaleDateString()}.`:plan.canPurchase
   ?plan.trialBlocked?'This Android device has already used a free trial. Choose a plan to continue.'
    :plan.trialEndsAt?'Your free trial has ended. Choose a plan to resume your missions and saved progress.'
    :'Open the updated Android app to check your free trial eligibility.'
   :'Ask your parent to activate your family plan.'}</p>
  {plan.canPurchase&&<div className="family-plan-actions">
   {native&&!plan.active&&plans.filter(item=>['monthly','yearly'].includes(item.id)).sort((a,b)=>a.id.localeCompare(b.id)).map(item=><button type="button" className="button" disabled={busy} key={item.id} onClick={()=>void purchase(item.id)}>{item.price} / {item.id==='monthly'?'month':'year'}</button>)}
   {native&&<button type="button" className="button secondary" disabled={busy} onClick={()=>void purchase()}>Restore purchase</button>}
   {!native&&!plan.active&&<p>Open Real Life Quest on Android to choose a plan in Google Play.</p>}
   {!plan.active&&plans.length>0&&<p>Subscriptions renew automatically until cancelled in Google Play.</p>}
   <a href={manage} target="_blank" rel="noreferrer">Manage Google Play subscription</a>
  </div>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
