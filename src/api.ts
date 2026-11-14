import {Capacitor,registerPlugin} from '@capacitor/core';
import {firebaseEnabled,firebaseApiBase,sessionPrefix} from './backend';
import {sessionToken,sessionUser,persistCredentials,clearCredentials,pairedChild} from './sessionStorage';
export {pairedChild};
import type {PhotoMode} from './proof';
export type ApiUser = { id:string; displayName:string; role:'parent'|'child'; age?:number|null };
export type FamilyPlan = {active:boolean;trialEndsAt:string|null;trialBlocked?:boolean;paid:boolean;canPurchase:boolean;accountId:string};
const trialBilling=registerPlugin<{trialDevice():Promise<{hash:string}>}>('FamilyBilling');
let trialDevice:Promise<string>|undefined;
export type RepeatFrequency = 'daily'|'weekdays'|'weekends'|'weekly';
export type MissionTemplate = {childId:string;title:string;missionTitle:string;description:string;coins:number;xp:number;difficulty?:'easy'|'medium'|'hard';category?:string;icon?:string;days?:string;photoRequired?:boolean;photoMode?:PhotoMode;dueDate?:string};
export type RecurringMission = {id:string;childId:string;title:string;frequency:RepeatFrequency;time:string;timezone:string;nextAt:string};
export type ApiSession = { user:ApiUser; token:string; familyId?:string;childDeviceToken?:string };
export type ApiTask = { id:string; family_id:string; created_by:string; assigned_to:string; title:string; mission_title:string; description:string; coins:number; xp:number; difficulty?:'easy'|'medium'|'hard'|null; category?:string;icon?:string;days?:string;photo_required?:number;photo_mode?:PhotoMode;child_name?:string;status:'active'|'submitted'|'approved'|'rejected'; due_date?:string|null };
export type ApiSubmission = ApiTask & {task_id:string;submission_id:string;child_id?:string;child_name:string;note?:string;proof_url?:string;proof_before_url?:string;child_avatar_data?:string|null;parent_feedback?:string;has_proof?:number;has_before_proof?:number};
export type ApiNotification = { id:string; type:string; title:string; body:string; read_at?:string|null; created_at:string };
export type ApiMember = { id:string; display_name:string; role:'parent'|'child'|'co_parent'; age?:number;avatar_data?:string|null;coins:number; xp:number; level:number; stars:number };
export type WeeklyTheme = { week:string; key:string; title:string; emoji:string; blurb:string };
export type LeagueEntry = { id:string; display_name:string; avatar_data?:string|null; xp:number; rank:number; isMe:boolean };
export type LeagueHistoryItem = { week:string; division:number; divisionName:string; rank:number; movement:'promoted'|'relegated'|'stayed'; xp:number };
export type LeagueGroup = { childId:string; childName:string; ageBand:'little'|'junior'|'teen'; division:number; divisionName:string; entries:LeagueEntry[]; history:LeagueHistoryItem[]; optedOut?:boolean; optedOutReason?:'parent_opt_out'|'consent_required'|'moderation'|null };
export type LeagueResponse = { week:string; theme:WeeklyTheme; divisions:Record<string,string>; leagues:LeagueGroup[] };
export type FamilyParent = { id:string; displayName:string; email:string; role:'parent'|'co_parent'; isPrimary:boolean; joinedAt:string };
export type FamilyParentsResponse = { parents:FamilyParent[]; viewerIsPrimary:boolean };
export type FamilyShare = { familyName:string; totals:{children:number;xp:number;stars:number;coins:number}; topChild:{name:string;xp:number;level:number}|null; referralCode:string; referralUrl:string; referredCount:number; theme:WeeklyTheme };
export type LeaderboardEntry = { id:string; display_name:string; age?:number|null; avatar_data?:string|null; xp:number; ageBand:'little'|'junior'|'teen'; level?:number; coins?:number; stars?:number };
export type LeaderboardResponse = { week:string; allTime:LeaderboardEntry[]; weekly:LeaderboardEntry[] };
export type ChallengeStanding = { familyId:string; name:string; children:number; weekXp:number; avgXp:number; isMe:boolean; rank:number };
export type Challenge = { id:string; name:string; code:string; week:string; currentWeek:string; status:'open'|'closed'; isOwner:boolean; standings:ChallengeStanding[] };
export type ChallengeList = { week:string; challenges:Challenge[] };
export type ConsentChild = { childId:string; name:string; ageBand:'little'|'junior'|'teen'; consented:boolean; consentAt:string|null; consentBy:string|null; leagueOptIn:boolean; publicNickname:string|null; effectiveNickname:string; publicAllowedByDefault:boolean };
export type ConsentEntry = { childId:string; childName:string; scope:string; granted:boolean; createdAt:string; revokedAt:string|null };
export type ConsentResponse = { children:ConsentChild[]; history:ConsentEntry[]; scopes:Record<string,string> };
export type SafetyReport = { id:string; reason:string; details:string; status:'open'|'reviewed'|'actioned'; reportedName:string; createdAt:string };
export type FamilyExport = { exportedAt:string; family:{id:string;name:string} }&Record<string,unknown>;
export const PRESET_REACTIONS = ['👏','🔥','⭐'];
export const REPORT_REASONS = ['name','avatar','behaviour','spam','other'];
export const REPORT_REASON_LABELS:Record<string,string>={name:'Unkind or fake name',avatar:'Inappropriate avatar',behaviour:'Unfriendly behaviour',spam:'Spam',other:'Something else'};

const apiEnvironment = (import.meta as ImportMeta & {env?:Record<string,string>}).env;
const API_BASE = (firebaseEnabled?firebaseApiBase:((Capacitor.isNativePlatform() ? apiEnvironment?.VITE_ANDROID_API_BASE_URL : undefined)
  || apiEnvironment?.VITE_API_BASE_URL || '/api')).replace(/\/$/, '');
const TOKEN_KEY = sessionPrefix+'token';
export const childSessionKey=firebaseEnabled?'rlq_firebase_child_id':'rlq_child_id';
let firebaseSignOutPending:Promise<void>=Promise.resolve();

export function getApiToken():string { return firebaseEnabled?localStorage.getItem(TOKEN_KEY)||'':sessionToken(); }
export function storedApiUser():ApiUser|null {if(!firebaseEnabled)return sessionUser();try{return JSON.parse(localStorage.getItem(sessionPrefix+'user')||'null')}catch{return null}}
export async function saveApiSession(session:ApiSession):Promise<void> {
 if(firebaseEnabled)localStorage.setItem(TOKEN_KEY,session.token);
 else {await persistCredentials(session.token,session.user.role==='child'&&session.childDeviceToken?{id:session.user.id,token:session.childDeviceToken,name:session.user.displayName}:undefined,session);return;}
 localStorage.setItem(sessionPrefix+'user',JSON.stringify(session.user));if(session.familyId)localStorage.setItem(sessionPrefix+'family',session.familyId);else localStorage.removeItem(sessionPrefix+'family');
}
export function clearApiSession():void { if(!firebaseEnabled)void clearCredentials().catch(()=>{});localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(sessionPrefix+'user'); localStorage.removeItem(sessionPrefix+'family');if(firebaseEnabled)firebaseSignOutPending=import('./firebaseTransport').then(m=>m.firebaseSignOut()).catch(()=>{}); }

async function request<T>(path:string,init:RequestInit={}):Promise<T> {
 if(firebaseEnabled){await firebaseSignOutPending;return (await import('./firebaseTransport')).firebaseRequest<T>(path,init);}
 const headers=new Headers(init.headers);headers.set('Accept','application/json');if(init.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');const token=getApiToken();if(token)headers.set('Authorization',`Bearer ${token}`);
 if(token&&Capacitor.getPlatform()==='android'&&(path==='/family'||path==='/billing')){
  trialDevice??=trialBilling.trialDevice().then(result=>result.hash).catch(()=>{trialDevice=undefined;return '';});
  const hash=await trialDevice;
  if(hash)headers.set('X-RLQ-Trial-Device',hash);
 }
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(`${API_BASE}${path}`,{...init,headers,signal:controller.signal});
  const payload=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(typeof payload?.error==='string'?payload.error:`Request failed (${response.status})`);Object.assign(error,{status:response.status});throw error;}return payload as T;
 }catch(error){if(controller.signal.aborted)throw new Error('The connection timed out. Check your internet and try again.');if(error instanceof Error&&('status' in error))throw error;throw new Error('Could not connect. Check your internet and try again.');}finally{clearTimeout(timeout);}
}

export const api={
  billing:()=>request<{plan:FamilyPlan}>('/billing'),
  verifyPurchase:(purchaseToken:string)=>request<{plan:FamilyPlan}>('/billing/verify',{method:'POST',body:JSON.stringify({purchaseToken})}),
  weeklyReport:(week:'current'|'previous')=>request<{week:string;children:{id:string;display_name:string;xp:number;coins:number;approved:number}[]}>(`/reports/weekly?week=${week}`),
  recurringMissions:()=>request<{rules:RecurringMission[]}>('/recurring-missions'),
  scheduleMission:(input:{childId:string;task:MissionTemplate;frequency:RepeatFrequency;time:string;timezone:string;weekday:number})=>request<{ok:boolean}>('/recurring-missions',{method:'POST',body:JSON.stringify(input)}),
  stopRecurringMission:(id:string)=>request<{ok:boolean}>(`/recurring-missions/${encodeURIComponent(id)}/stop`,{method:'POST'}),
  registerPushDevice:(input:{installationId:string;token?:string;disable?:boolean;channelId?:string})=>request<{ok:boolean}>('/notifications/device',{method:'POST',body:JSON.stringify(input)}),
  logout:()=>request<{ok:boolean}>('/auth/logout',{method:'POST',body:'{}'}),
  connectChildPhone:(childId:string)=>request<{code:string;expiresAt:string}>('/families/child-device-code',{method:'POST',body:JSON.stringify({childId})}),
  base:API_BASE,
  moderationReports:()=>request<{reports:Array<{id:string;reason:string;details:string;created_at:string}>}>('/moderation/reports'),
  moderateReport:(id:string,action:'reviewed'|'hide_from_league'|'restore_eligibility')=>request<{ok:boolean}>(`/moderation/reports/${encodeURIComponent(id)}`,{method:'POST',body:JSON.stringify({action})}),
  requestPasswordReset:(email:string)=>request<{ok:boolean;message:string}>('/auth/password/request',{method:'POST',body:JSON.stringify({email})}),
  authMethods:()=>request<{google:boolean;primary:boolean;moderator?:boolean}>('/account/auth-methods'),
  reauthGoogle:(input:{idToken:string;nonce:string})=>request<{reauthToken:string}>('/account/reauth-google',{method:'POST',body:JSON.stringify(input)}),
  deleteSelf:(input:{password:string;reauthToken?:string;confirm:string})=>request<{ok:boolean}>('/account/delete-self',{method:'POST',body:JSON.stringify(input)}),
  googleChallenge:()=>request<{nonce:string}>('/auth/google/challenge',{method:'POST',body:'{}'}),
  googleLogin:(input:{idToken:string;nonce:string;password?:string;coParentCode?:string})=>request<ApiSession>('/auth/google',{method:'POST',body:JSON.stringify(input)}),
  health:()=>request<{ok:boolean;service:string}>('/health'),
  registerParent:(input:{email:string;password:string;displayName:string;ref?:string})=>request<ApiSession>('/auth/register',{method:'POST',body:JSON.stringify(input)}),
  login:(input:{email:string;password:string})=>request<ApiSession>('/auth/login',{method:'POST',body:JSON.stringify(input)}),
  childLogin:(input:{displayName:string;pin:string;parentEmail?:string;childId?:string;deviceCode?:string;deviceToken?:string})=>request<ApiSession>('/auth/child-login',{method:'POST',body:JSON.stringify(input)}),
  registerChild:(input:{displayName:string;age:number;code:string;pin:string})=>request<ApiSession>('/auth/register-child',{method:'POST',body:JSON.stringify(input)}),
  registerCoParent:(input:{email:string;password:string;displayName:string;code:string})=>request<ApiSession>('/auth/register-coparent',{method:'POST',body:JSON.stringify(input)}),
  resetChildPin:(childId:string,pin:string)=>request<{ok:boolean}>('/family/child-pin',{method:'PATCH',body:JSON.stringify({childId,pin})}),
  deleteChild:(childId:string,password:string,reauthToken?:string)=>request<{ok:boolean}>('/family/delete-child',{method:'POST',body:JSON.stringify({childId,password,reauthToken})}),
  changePassword:(currentPassword:string,newPassword:string,reauthToken?:string)=>request<{ok:boolean}>('/account/password',{method:'PATCH',body:JSON.stringify({currentPassword,newPassword,reauthToken})}),
  updateProfile:(input:{childId?:string;displayName?:string;age?:number;avatarData?:string|null})=>request<{ok:boolean}>('/profile',{method:'PATCH',body:JSON.stringify(input)}),
  rewards:()=>request<{rewards:Array<{id:string;name:string;description:string;cost_coins:number}>;requests:Array<{id:string;reward_id:string;name:string;child_name:string;cost_coins:number;status:string}>}>('/rewards'),
  addReward:(input:{name:string;description:string;cost:number})=>request<{id:string}>('/rewards',{method:'POST',body:JSON.stringify(input)}),
  requestReward:(id:string)=>request<{id:string}>(`/rewards/${encodeURIComponent(id)}/request`,{method:'POST',body:'{}'}),
  reviewReward:(id:string,approve:boolean)=>request<{ok:boolean}>(`/reward-requests/${encodeURIComponent(id)}/${approve?'approve':'reject'}`,{method:'POST',body:'{}'}),
  createPairingCode:(input:{childName:string;childAge:number;tasks:Array<{title:string;missionTitle:string;description:string;coins:number;xp:number;category:string;icon:string;days:'both'|'Weekdays'|'Weekends'|'Once';photoMode?:PhotoMode}>})=>request<{code:string;expiresAt:string;inviteUrl:string}>('/families/pairing-code',{method:'POST',body:JSON.stringify(input)}),
  family:()=>request<{family:{id:string;name:string;parent_id?:string;schedule_json?:string|null};members:ApiMember[];plan?:FamilyPlan|null}>('/family'),
  saveSchedule:(schedule:unknown)=>request<{ok:boolean}>('/family/schedule',{method:'PATCH',body:JSON.stringify(schedule)}),
  suggest:(name:string)=>request<{ok:boolean}>('/suggestions',{method:'POST',body:JSON.stringify({name})}),
  tasks:()=>request<{tasks:ApiTask[]}>('/tasks'),
  assignTask:(input:{childId:string;title:string;missionTitle:string;description:string;coins:number;xp:number;difficulty?:'easy'|'medium'|'hard';category?:string;icon?:string;days?:string;photoRequired?:boolean;photoMode?:PhotoMode;dueDate?:string})=>request<{id:string}>('/tasks',{method:'POST',body:JSON.stringify(input)}),
  submitTask:(id:string,input:{note?:string;proofUrl?:string;proofBeforeUrl?:string})=>request<{submissionId:string}>(`/tasks/${encodeURIComponent(id)}/submit`,{method:'POST',body:JSON.stringify(input)}),
  submissions:(cursor?:string)=>request<{submissions:ApiSubmission[];nextCursor?:string|null}>('/submissions'+(cursor?'?cursor='+encodeURIComponent(cursor):'')),
  submissionProof:(id:string)=>request<{proofUrl:string|null;proofBeforeUrl:string|null}>(`/submissions/${encodeURIComponent(id)}/proof`),
  reviewSubmission:(id:string,approved:boolean,feedback?:string)=>request<{status:'approved'|'rejected'}>(`/submissions/${encodeURIComponent(id)}/${approved?'approve':'reject'}`,{method:'POST',body:JSON.stringify({feedback})}),
  notifications:()=>request<{notifications:ApiNotification[]}>('/notifications'),
  leaderboard:()=>request<LeaderboardResponse>('/leaderboard'),
  challenges:()=>request<ChallengeList>('/challenges'),
  createChallenge:(name:string)=>request<{id:string;code:string;name:string;week:string}>('/challenges',{method:'POST',body:JSON.stringify({name})}),
  joinChallenge:(code:string)=>request<{id:string;name:string}>('/challenges/join',{method:'POST',body:JSON.stringify({code})}),
  league:()=>request<LeagueResponse>('/league'),
  coParentCode:()=>request<{code:string;codeDisplay:string;expiresAt:string;inviteUrl:string}>('/families/co-parent-code',{method:'POST',body:'{}'}),
  familyParents:()=>request<FamilyParentsResponse>('/families/parents'),
  removeCoParent:(coParentId:string)=>request<{ok:boolean}>('/families/remove-coparent',{method:'POST',body:JSON.stringify({coParentId})}),
  familyShare:()=>request<FamilyShare>('/families/share'),
  // Spec section 10: consent, moderation and the parent's data rights.
  consent:()=>request<ConsentResponse>('/safety/consent'),
  setConsent:(childId:string,granted:boolean,scope='app_data_collection')=>request<{child:ConsentChild;granted:boolean}>('/safety/consent',{method:'POST',body:JSON.stringify({childId,granted,scope})}),
  setNickname:(childId:string,nickname:string)=>request<{childId:string;publicNickname:string}>('/safety/nickname',{method:'POST',body:JSON.stringify({childId,nickname})}),
  setLeagueOptIn:(childId:string,enabled:boolean)=>request<{childId:string;leagueOptIn:boolean;ageBand:string}>('/league/opt-in',{method:'POST',body:JSON.stringify({childId,enabled})}),
  reportUser:(userId:string,reason:string,details?:string)=>request<{id:string;status:string;blocked:boolean}>('/safety/report',{method:'POST',body:JSON.stringify({userId,reason,details})}),
  myReports:()=>request<{reports:SafetyReport[]}>('/safety/reports'),
  setBlock:(userId:string,blocked:boolean)=>request<{userId:string;blocked:boolean}>('/safety/block',{method:'POST',body:JSON.stringify({userId,blocked})}),
  myBlocks:()=>request<{blocks:string[]}>('/safety/blocks'),
  react:(userId:string,emoji:string)=>request<{userId:string;counts:Record<string,number>;mine:string[]}>('/safety/reaction',{method:'POST',body:JSON.stringify({userId,emoji})}),
  exportFamilyData:()=>request<FamilyExport>('/safety/export'),
  eraseChild:(childId:string,password:string,confirm:string,reauthToken?:string)=>request<{ok:boolean}>('/safety/erase-child',{method:'POST',body:JSON.stringify({childId,password,confirm,reauthToken})}),
  eraseFamily:(password:string,confirm:string,reauthToken?:string)=>request<{ok:boolean;deleted:boolean}>('/safety/erase-family',{method:'POST',body:JSON.stringify({password,confirm,reauthToken})}),
};

