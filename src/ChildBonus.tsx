import {Plus} from 'lucide-react';
import type {ReactNode} from 'react';
import type {Quest} from './state';

export default function ChildBonus({quests,online,multiplier,onSuggest,renderQuest}:{quests:Quest[];online:boolean;multiplier:boolean;onSuggest:()=>void;renderQuest:(q:Quest)=>ReactNode}){
 const bonus=quests.filter(q=>q.category==='Bonus');
 return <div className="child-bonus">
  <section className="weekend-card"><span aria-hidden="true">{online?'🌟':'🗓️'}</span><div><small>{online?'KINDNESS REWARDS':'WEEKEND MULTIPLIER'}</small><h2>{online?'Extra':multiplier?'1.5×':'Weekend'} <span>Coins</span></h2><p>{online?'Do a kind deed. Your parent approves your coins.':multiplier?'This weekend’s bonus is on!':'Your parent can turn on weekend bonuses.'}</p></div><span className="sparkle" aria-hidden="true">✦</span></section>
  <div className="kid-section-label"><h2>Your bonus missions</h2><span aria-hidden="true">💛</span></div>
  <div className="quest-list">{bonus.map(renderQuest)}</div>
  {!bonus.length&&<section className="bonus-empty"><span aria-hidden="true">💛</span><h3>A little kindness starts with you</h3><p>No bonus missions yet. Suggest a helpful deed for your parent to review.</p><div className="empty-tip-card"><span className="tip-star" aria-hidden="true">✨</span><span><strong>Hero Tip:</strong> Small deeds like tidying toys or helping with dinner count as great adventures!</span></div></section>}
  <button className="suggest-card" onClick={onSuggest}><span aria-hidden="true">🙋</span><div><strong>Suggest a Deed</strong><small>Tap to suggest</small></div><Plus/></button>
  <p className="caption">Coins arrive after your parent approves your completed mission.</p>
 </div>;
}
