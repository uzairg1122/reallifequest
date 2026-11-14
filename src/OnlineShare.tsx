import {useEffect, useState} from 'react';
import {Share2, RefreshCw, Copy, Check, Download} from 'lucide-react';
import {api, type FamilyShare} from './api';
import {parentText, useAppLanguage} from './parentLanguage';
import {makeProgressCard, saveProgressCard, shareProgressCard} from './progressCard';

export default function OnlineShare() {
  const locale = useAppLanguage();
  const translate = (value: string) => parentText(locale, value);
  const [data, setData] = useState<FamilyShare | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [card, setCard] = useState<{blob: Blob; url: string; locale: string} | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    api.familyShare().then(result => {
      if (active) setData(result);
    }).catch(() => {
      if (active) setError('Could not load your share card.');
    });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    if (!data) return;
    let active = true;
    let url: string | undefined;
    makeProgressCard(data, value => parentText(locale, value), locale).then(blob => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      setCard({blob, url, locale});
    }).catch(() => {
      if (active) setError('Could not create your share image.');
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [data, locale]);

  const ready = card?.locale === locale ? card : null;
  async function exportCard(action: 'share' | 'save') {
    if (!ready || busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (action === 'share') await shareProgressCard(ready.blob);
      else setMessage(await saveProgressCard(ready.blob));
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setMessage(error instanceof Error ? error.message : 'Could not export your card. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.referralUrl);
      setMessage('Referral link copied.');
    } catch {
      setMessage('Copy failed. Select the link to copy it.');
    }
  }

  return <div className="share-screen parent-share">
    {error ? <section className="card">
      <p role="alert" className="form-error">{translate(error)}</p>
      <button className="text-button" onClick={() => {
        setCard(null);
        setData(null);
        setError('');
        setAttempt(value => value + 1);
      }}><RefreshCw size={15}/> {translate('Try again')}</button>
    </section> : ready ? <section className="card share-card">
      <img src={ready.url} width={1080} height={1080} className="share-canvas"
        alt={translate('Family progress') + (data ? `: ${data.totals.xp} ${translate('Total XP')}, ${data.totals.stars} ${translate('Stars')}` : '')}/>
      <div className="share-actions">
        <button className="button" disabled={busy} onClick={() => void exportCard('share')}>
          <Share2 size={18}/> {translate('Share card')}
        </button>
        <button className="button secondary" disabled={busy} onClick={() => void exportCard('save')}>
          <Download size={18}/> {translate('Save image')}
        </button>
      </div>
    </section> : <p role="status" className="caption">{translate('Loading your card…')}</p>}
    {message && <p role="status" className="wallet-message">{translate(message)}</p>}
    {data && <section className="card share-referral">
      <h3>{translate('Your referral link')}</h3>
      <div className="share-referral-row">
        <code className="share-referral-code">{data.referralCode}</code>
        <button className="text-button" onClick={() => void copyLink()}><Copy size={16}/> {translate('Copy link')}</button>
      </div>
      <p className="share-referral-url">{data.referralUrl}</p>
    </section>}
  </div>;
}
