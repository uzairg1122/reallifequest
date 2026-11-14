import {useAppText} from './parentLanguage';
import {parentGoogleOnly} from './backend';
import {exportJson} from './exportJson';
import GoogleConfirmation from './GoogleConfirmation';
import {useCallback,useEffect,useState} from 'react';
import {Download,EyeOff,ShieldCheck,Trash2,UserRound,AlertTriangle,LockKeyhole,Check} from 'lucide-react';
import {api,REPORT_REASON_LABELS,type ConsentChild,type ConsentResponse,type FamilyExport,type SafetyReport} from './api';

// Spec section 10 in one parent-facing place: consent, public league opt-in, the public
// nickname, the reports this family has filed, and the parent's export/delete rights.
// Everything here is online-only because these are server-side records.
const bandLabel=(band:ConsentChild['ageBand'])=>({little:'Little (6–9)',junior:'Junior (10–12)',teen:'Teen (13+)'}[band]);

export default function ParentSafety({onChanged,league=false}:{onChanged?:()=>void;league?:boolean}){
 const translate=useAppText();
  const [reauthToken,setReauthToken]=useState('');
  const [data,setData]=useState<ConsentResponse|null>(null);
  const [reports,setReports]=useState<SafetyReport[]>([]);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [note,setNote]=useState('');
  const [nicknames,setNicknames]=useState<Record<string,string>>({});
  const [eraseTarget,setEraseTarget]=useState<ConsentChild|null>(null);
  const [erasePassword,setErasePassword]=useState('');
  const [eraseConfirm,setEraseConfirm]=useState('');
  const [familyPassword,setFamilyPassword]=useState('');
  const [familyConfirm,setFamilyConfirm]=useState('');
  const [showFamilyDelete,setShowFamilyDelete]=useState(false);

  const load=useCallback(async()=>{
    setError('');
    try{
      const[consent,filed]=await Promise.all([api.consent(),api.myReports()]);
      setData(consent);setReports(filed.reports);
      setNicknames(Object.fromEntries(consent.children.map(c=>[c.childId,c.publicNickname||c.effectiveNickname])));
    }catch(e){setError(e instanceof Error?e.message:'Could not load your privacy settings.');}
  },[]);
  useEffect(()=>{if(league)void load();},[league,load]);

  // Each action reports which child it touched so the parent can see exactly what changed.
  const run=async(key:string,label:string,fn:()=>Promise<unknown>)=>{
    setBusy(key);setError('');setNote('');
    try{await fn();setNote(label);if(league)await load();onChanged?.();}
    catch(e){setError(e instanceof Error?e.message:'Something went wrong. Please try again.');}
    finally{setBusy('');setReauthToken('');}
  };

  if(league&&(!data||!Array.isArray(data.children))) return <section className="card safety-card"><h3><ShieldCheck/> {translate("Privacy & Safety")}</h3>{error&&<p className="form-error" role="alert">{error}</p>}<p className="caption">{error?'Privacy settings are unavailable right now.':translate('Loading…')}</p></section>;

  const scopeEntries=Object.entries(data?.scopes||{});

  return <section className="card safety-card">
    <h3>{league?<><ShieldCheck/> {translate("Privacy & Safety")}</>:<><Download/> {translate("Your family data")}</>}</h3>
    {note&&<p className="safety-note" role="status"><Check size={15}/>{note}</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}

    {league&&data?.children.length===0&&<p className="caption">Invite a child first, then come back to give consent.</p>}

    {league&&data?.children.map(child=>{const isLittle=child.ageBand==='little';return <div className="safety-child" key={child.childId}>
      <div className="safety-child-head"><span className="child-avatar-fallback">🧒</span><div><strong>{child.name}</strong><small>{bandLabel(child.ageBand)}</small></div><span className={'child-badge'+(child.consented?' is-on':'')}>{child.consented?'Consented':'Not consented'}</span></div>

      <div className="safety-scope-list">{scopeEntries.map(([key,text])=><div className="setting-row" key={key}><span>{text}</span></div>)}</div>

      <div className="setting-row">
        <span><LockKeyhole/> Store this child&rsquo;s data on our servers</span>
        <button type="button" role="switch" aria-checked={child.consented} aria-label={`Store ${child.name}’s data on our servers`} className={`toggle ${child.consented?'on':''}`} disabled={busy===child.childId} onClick={()=>void run(child.childId,child.consented?'Consent withdrawn. Your child is now fully private.':`Consent recorded for ${child.name}.`,()=>api.setConsent(child.childId,!child.consented))}><i/></button>
      </div>
      {child.consented&&<p className="safety-hint">Consented {new Date(child.consentAt!).toLocaleDateString()}.</p>}

      <div className="setting-row">
        <span><EyeOff/> Public weekly league</span>
        <button type="button" role="switch" aria-checked={child.consented&&child.leagueOptIn} aria-label={`${child.name} on public weekly league`} className={`toggle ${child.consented&&child.leagueOptIn?'on':''}`} disabled={busy===child.childId||!child.consented} onClick={()=>void run(child.childId,child.leagueOptIn?`${child.name} left the public league.`:`${child.name} joined the public league.`,()=>api.setLeagueOptIn(child.childId,!child.leagueOptIn))}><i/></button>
      </div>
      {isLittle&&<p className="safety-hint">{child.leagueOptIn?'On':'Off'} · Little band is family-board-only by default. Other families see the nickname, avatar and weekly XP only.</p>}
      {!child.consented&&<p className="safety-hint">Give consent first, then the public league can be turned on.</p>}

      <label className="safety-nickname">Public nickname<input value={nicknames[child.childId]??''} maxLength={24} placeholder="Letters only, no numbers" onChange={e=>setNicknames(n=>({...n,[child.childId]:e.target.value}))}/></label>
      <Button2 label={child.publicNickname?'Update nickname':'Set nickname'} disabled={busy===child.childId} onClick={()=>void run(child.childId,`Nickname updated for ${child.name}.`,()=>api.setNickname(child.childId,nicknames[child.childId]||''))}/>
      <p className="safety-hint">Shown as <b>{child.effectiveNickname}</b>. Other families never see the real name, photo, school or location.</p>

      <button className="danger-text safety-erase-link" onClick={()=>{setEraseTarget(child);setErasePassword('');setEraseConfirm('');}}><Trash2 size={16}/> Erase all of {child.name}&rsquo;s data</button>
    </div>;})}

    {league&&Array.isArray(data?.history)&&data.history.length>0&&<details className="safety-audit"><summary>Consent history ({data.history.length})</summary>{data.history.slice(0,20).map((entry,i)=><p key={i}><b>{entry.childName}</b> · {entry.granted?'consented':'withdrew consent'} · {new Date(entry.createdAt).toLocaleString()}</p>)}</details>}

    {reports.length>0&&<details className="safety-audit"><summary>Reports you filed ({reports.length})</summary>{reports.map(r=><p key={r.id}><b>{r.reportedName}</b> · {REPORT_REASON_LABELS[r.reason]||r.reason} · {r.status} · {new Date(r.createdAt).toLocaleDateString()}</p>)}</details>}

    {!league&&<Button2 label={translate("Download my data")} disabled={Boolean(busy)} onClick={async()=>{
      setBusy('export');setError('');
      try{
        const payload=await api.exportFamilyData() as FamilyExport;
        await exportJson(`real-life-quest-${payload.family.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.json`,payload);
        setNote('Your family export is ready. Save it in a private location.');
      }catch(e){setError(e instanceof Error?e.message:'Could not build your export.');}
      finally{setBusy('');}
    }}/>}

    {eraseTarget&&<div className="safety-danger-box">
      <h4><AlertTriangle/> Erase {eraseTarget.name}&rsquo;s data</h4>
      <p>This permanently removes {eraseTarget.name}&rsquo;s missions, photo records, coins, XP history and league history. It cannot be undone.</p>
      <GoogleConfirmation value={reauthToken} onVerified={setReauthToken}/>{!parentGoogleOnly&&<label>Your parent password (or Google verification above)<input type="password" autoComplete="current-password" value={erasePassword} onChange={e=>setErasePassword(e.target.value)}/></label>}
      <label>Type <b>erase {eraseTarget.name}</b> to confirm<input value={eraseConfirm} onChange={e=>setEraseConfirm(e.target.value)}/></label>
      <div className="safety-danger-actions">
        <Button2 label={`Erase ${eraseTarget.name}`} danger disabled={busy==='erase-child'} onClick={()=>void run('erase-child',`${eraseTarget.name}’s data was erased.`,async()=>{await api.eraseChild(eraseTarget.childId,erasePassword,eraseConfirm,reauthToken);setEraseTarget(null);})}/>
        <Button2 label={translate("Cancel")} onClick={()=>setEraseTarget(null)}/>
      </div>
    </div>}

    {!league&&(!showFamilyDelete?<button className="danger-text safety-erase-link" onClick={()=>setShowFamilyDelete(true)}><UserRound size={16}/> Delete this entire family account</button>:
      <div className="safety-danger-box">
        <h4><AlertTriangle/> Delete your whole family</h4>
        <p>This signs out every parent and child and deletes every record we hold. It cannot be undone.</p>
        <GoogleConfirmation value={reauthToken} onVerified={setReauthToken}/>{!parentGoogleOnly&&<label>Your parent password<input type="password" autoComplete="current-password" value={familyPassword} onChange={e=>setFamilyPassword(e.target.value)}/></label>}
        <label>Type <b>DELETE MY FAMILY</b> to confirm<input value={familyConfirm} onChange={e=>setFamilyConfirm(e.target.value)}/></label>
        <div className="safety-danger-actions">
          <Button2 label="Delete my family" danger disabled={busy==='erase-family'} onClick={()=>void run('erase-family','Your family account was deleted.',async()=>{await api.eraseFamily(familyPassword,familyConfirm,reauthToken);onChanged?.();})}/>
          <Button2 label="Keep my family" onClick={()=>setShowFamilyDelete(false)}/>
        </div>
      </div>)}
  </section>;
}

function Button2({label,onClick,disabled,danger}:{label:string;onClick:()=>void;disabled?:boolean;danger?:boolean}){
  return <button type="button" className={`button ${danger?'':'secondary'} safety-button`} onClick={onClick} disabled={disabled}>{label}</button>;
}
