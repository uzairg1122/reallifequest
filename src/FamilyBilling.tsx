import {Capacitor,registerPlugin} from '@capacitor/core';
import {useEffect,useState} from 'react';
import {api,getApiToken,type FamilyPlan} from './api';
import missionsArt from '../assets/parent-redesign/icons/assign-quest.png';
import reportsArt from '../assets/parent-redesign/icons/family-progress.png';
import scheduleArt from '../assets/parent-redesign/icons/settings.png';

type PlayPlan = {id:string;price:string};
type Purchases = {tokens:string[];pending:boolean};
const billing = registerPlugin<{
 plans():Promise<{plans:PlayPlan[]}>;
 buy(input:{planId:string;accountId:string}):Promise<Purchases>;
 restore():Promise<Purchases>;
}>('FamilyBilling');

export function FamilyPlanBenefits() {
 return <ul className="family-plan-benefits">
  <li><img src={missionsArt} alt=""/>Family missions &amp; rewards</li>
  <li><img src={reportsArt} alt=""/>Weekly progress reports</li>
  <li><img src={scheduleArt} alt=""/>Automatic task assignments</li>
 </ul>;
}

const trialDate = new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',year:'numeric'});
export function TrialDates({plan}:{plan:FamilyPlan}) {
 return <span className="family-trial-dates">
  {plan.trialStartedAt&&<span>Started <time dateTime={plan.trialStartedAt}>{trialDate.format(new Date(plan.trialStartedAt))}</time></span>}
  {plan.trialEndsAt&&<span>Ends <time dateTime={plan.trialEndsAt}>{trialDate.format(new Date(plan.trialEndsAt))}</time></span>}
 </span>;
}

export default function FamilyBilling({plan,onPlan}:{plan:FamilyPlan;onPlan:(plan:FamilyPlan)=>void}) {
 const [plans,setPlans]=useState<PlayPlan[]>([]);
 const [selected,setSelected]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const native=Capacitor.getPlatform()==='android';
 const manage='https://play.google.com/store/account/subscriptions?sku=family_access&package=com.reallifequest.app';
 useEffect(()=>{
  if(!native||!plan.canPurchase||plan.paid)return;
  let mounted=true;
  billing.plans().then(result=>{if(mounted)setPlans(result.plans);}).catch(error=>{if(mounted)setMessage(error.message);});
  return ()=>{mounted=false;};
 },[native,plan.canPurchase,plan.paid]);
 const available=plans.filter(item=>['monthly','yearly'].includes(item.id));
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
  <h2>{plan.paid?'Family subscription':'Subscription options'}</h2>
  <p>{plan.paid?'Your family subscription is active.':plan.active&&plan.trialEndsAt?`Your free trial ends on ${new Date(plan.trialEndsAt).toLocaleDateString()}.`:plan.canPurchase
   ?plan.trialBlocked?'This Android device has already used a free trial. Choose a plan to continue.'
    :plan.trialEndsAt?'Your free trial has ended. Choose a plan to resume your missions and saved progress.'
    :'Open the updated Android app to check your free trial eligibility.'
   :'Ask your parent to activate your family plan.'}</p>
  {plan.canPurchase&&<div className="family-plan-actions">
   {native&&!plan.paid&&available.length>0&&<fieldset className="family-plan-options" aria-label="Subscription plans">
    {available.map(item=><label className="family-plan-option" key={item.id}>
     <input type="radio" name="family-plan" value={item.id} checked={selected===item.id} disabled={busy} onChange={()=>setSelected(item.id)}/>
    <span><strong>{item.id==='monthly'?'Monthly':'Yearly'}</strong><small>{item.price} / {item.id==='monthly'?'month':'year'}</small></span>
    </label>)}
    <p>{plan.active?'If you subscribe now, Google Play charges you today. ':''}Renews automatically. Cancel anytime in Google Play.</p>
    <button type="button" className="button" disabled={busy||!available.some(item=>item.id===selected)} onClick={()=>void purchase(selected)}>Continue with Google Play</button>
   </fieldset>}
   {native&&!plan.paid&&available.length===0&&!message&&<p role="status">Subscription plans are currently unavailable.</p>}
   {native&&<button type="button" className="button secondary" disabled={busy} onClick={()=>void purchase()}>Restore purchase</button>}
   {!native&&!plan.paid&&<p>Open Super Tasker on Android to choose a plan in Google Play.</p>}
   <a href={manage} target="_blank" rel="noreferrer">Manage Google Play subscription</a>
  </div>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
