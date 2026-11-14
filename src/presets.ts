import type {Quest, State} from './state';

export type Preset = {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  minAge: 6 | 9;
  kind: 'Daily routines' | 'Helping tasks';
  minutes: string;
  help?: string;
  days: Quest['days'];
  coins: number;
  xp: number;
  legacyId?: string;
  timer?: boolean;
};

function routine(id:string,name:string,icon:string,category:string,description:string,minutes:string,extra:Partial<Preset>={}):Preset {
  return {id,name,icon,category,description,minutes,minAge:6,kind:'Daily routines',days:'both',coins:15,xp:20,...extra};
}
function helping(id:string,name:string,icon:string,description:string,minutes:string,extra:Partial<Preset>={}):Preset {
  return routine(id,name,icon,'Bonus',description,minutes,{kind:'Helping tasks',days:'Once',coins:30,xp:35,...extra});
}

// Age bands, estimated times and in-game rewards are product defaults, not clinical prescriptions.
// Source rationale and task selection are documented in PRESET_RESEARCH.md.
export const PRESETS:Preset[] = [
  routine('morning-teeth','Brush Your Teeth','🪥','Morning Routine','Brush every side of your teeth for two minutes with fluoride toothpaste. Ask your grown-up for help when needed.','2 min',{legacyId:'teeth',timer:true,coins:30,xp:45}),
  routine('wash-face','Wash Face & Hands','🫧','Morning Routine','Gently wash your face and hands, then dry with your own clean towel.','3 min'),
  routine('get-dressed','Get Dressed','👕','Morning Routine','Put on the clothes you and your grown-up chose for today. Ask for help with tricky buttons.','5 min',{legacyId:'dress'}),
  routine('make-bed','Make Your Bed','🛏️','Morning Routine','Straighten your blanket and put your pillow in place. A little effort is enough!','3 min',{legacyId:'bed',coins:20,xp:30}),
  routine('comb-hair','Comb Your Hair','🪮','Morning Routine','Gently brush or comb your hair. Ask a grown-up to help with tangles.','3 min'),
  routine('breakfast','Breakfast Time','🥣','Morning Routine','Join your family for the breakfast your grown-up has prepared. Tell them if you need help.','At your pace'),
  routine('pack-bag','Backpack Check','🎒','School & Homework','Check your school list with a grown-up. Pack your books, homework and anything else you need.','5 min',{legacyId:'bag',days:'Weekdays',coins:20,xp:30}),
  routine('water-bottle','Pack Your Water Bottle','💧','School & Homework','Fill your water bottle with help if needed, close the lid and put it in your bag.','2 min',{days:'Weekdays'}),
  routine('homework','Homework Check-in','📝','School & Homework','Look at today’s homework with a grown-up. Agree on one manageable piece to work on and ask for help when needed.','Parent sets time',{days:'Weekdays',coins:30,xp:45}),
  routine('read-book','Read a Book','📗','School & Homework','Choose a book you enjoy. Read on your own or listen while a grown-up reads with you.','10 min',{legacyId:'read',coins:25,xp:35}),
  routine('desk-reset','Clear Your Study Space','✏️','School & Homework','Put pencils in their holder and books in a neat pile so your study space is ready.','3 min'),
  routine('tomorrow-list','Check Tomorrow’s School List','📋','School & Homework','Read tomorrow’s timetable and check that the things you need are ready.','5 min',{minAge:9,days:'Weekdays'}),
  routine('toys-away','Put Toys Away','🧸','Tidy & Order','Put the toys you used back in their baskets. Start with one small area.','5 min',{legacyId:'toys',coins:20,xp:30}),
  routine('laundry-hamper','Clothes in the Hamper','🧺','Tidy & Order','Pick up your used clothes and put them in the laundry basket.','2 min'),
  routine('shoes-away','Shoes in Their Place','👟','Tidy & Order','Put your shoes together in their usual spot so you can find them next time.','2 min'),
  routine('books-away','Put Books on the Shelf','📚','Tidy & Order','Put the books you used back on a shelf you can reach without climbing.','3 min'),
  routine('pyjamas','Put On Pyjamas','🌙','Bedtime Wind-Down','Change into your bedtime clothes and put your used clothes in the hamper.','5 min',{legacyId:'pjs'}),
  routine('evening-teeth','Brush Teeth Before Bed','🪥','Bedtime Wind-Down','Brush gently for two minutes with fluoride toothpaste. Your grown-up can help you reach every side.','2 min',{timer:true,coins:20,xp:30}),
  routine('bedtime-story','Choose a Bedtime Story','📖','Bedtime Wind-Down','Choose one short story to read or listen to together as you wind down.','10 min'),
  routine('tomorrow-clothes','Lay Out Tomorrow’s Clothes','👚','Bedtime Wind-Down','Choose tomorrow’s clothes with your grown-up and put them in an easy-to-find place.','3 min'),
  routine('screens-away','Put Screens Away','📵','Bedtime Wind-Down','At your family’s agreed time, leave your screen in its usual place and choose a quiet activity.','2 min'),
  helping('set-table','Set the Dinner Table','🍽️','Put napkins, spoons and unbreakable plates on the table where your grown-up shows you.','5 min',{legacyId:'table',help:'Grown-up checks first; no knives or hot dishes.',coins:40}),
  helping('clear-table','Clear Your Place','🥄','Carry your empty, unbreakable plate and cup to the spot your grown-up chooses.','3 min',{help:'Leave glass, sharp items and hot dishes to an adult.'}),
  helping('water-plants','Water the Plants','🪴','Ask which plant needs water. Use the small amount your grown-up measures out.','5 min',{help:'Do together; use a small watering can.'}),
  helping('match-socks','Match the Socks','🧦','Find matching pairs of clean socks and put each pair together.','5 min'),
  helping('put-laundry-away','Put Clean Clothes Away','👕','Put clean clothes into the drawers or shelves your grown-up has shown you.','5 min'),
  helping('fold-towels','Fold Small Towels','🧺','Fold a few clean hand towels and stack them where your grown-up shows you.','5 min'),
  helping('wipe-table','Wipe the Table','🧽','Use a damp cloth to wipe a small, clear part of the table.','5 min',{help:'Water only; no cleaning chemicals or hot surfaces.'}),
  helping('recycle','Organize Recycling Bin','♻️','Sort clean paper and cardboard with your grown-up and place them in the correct bin.','5 min',{legacyId:'recycle',help:'Do together; no glass, sharp metal or dirty waste.',coins:40}),
  helping('puzzle-help','Help Sibling with Puzzle','🧩','Offer to share a puzzle or game with someone in your family. Ask what help they would like.','10 min',{legacyId:'puzzle',help:'An adult stays responsible for younger children.',coins:50,xp:40}),
  helping('sweep-floor','Sweep a Small Floor Area','🧹','Sweep the clear area your grown-up chooses into a small pile and use a dustpan.','10 min',{minAge:9,help:'Adult checks for sharp objects first.'}),
  helping('pack-lunch','Help Pack Your Lunch','🥪','With your grown-up, choose prepared food and pack it into your lunchbox.','10 min',{minAge:9,help:'Do together; adult handles knives, heat and food safety.'}),
  helping('grocery-list','Help Make a Grocery List','🛒','Ask your grown-up which everyday items to check, then help write or draw a shopping list.','10 min',{minAge:9}),
  helping('pet-water','Help Refill Pet Water','🐾','With your grown-up beside you, help refill your familiar pet’s water bowl.','5 min',{help:'Do together; adult handles the pet. Wash hands afterwards.'}),
];

export const PACKS = [
  {id:'morning',name:'Ready for the day',icon:'☀️',description:'Three small morning steps.',ids:['morning-teeth','get-dressed','make-bed']},
  {id:'school',name:'School-day sidekick',icon:'🎒',description:'A bag, a bottle, a little learning.',ids:['pack-bag','water-bottle','homework']},
  {id:'bedtime',name:'Sleepy-time stars',icon:'🌙',description:'A gentle end to the day.',ids:['pyjamas','evening-teeth','bedtime-story']},
  {id:'tidy',name:'My space, my little wins',icon:'🧸',description:'Give everyday things a home.',ids:['toys-away','laundry-hamper','shoes-away']},
  {id:'helping',name:'Little family helpers',icon:'💛',description:'Choose a few extra acts of help.',ids:['set-table','match-socks','water-plants']},
];

export function findPresetQuest(quests:Quest[],preset:Preset) {
  return quests.find(q=>q.presetId===preset.id || !!preset.legacyId&&q.id===preset.legacyId ||
    q.category===preset.category&&q.name.trim().toLowerCase()===preset.name.toLowerCase());
}

export function allowPresets(state:State,ids:string[],days?:Quest['days']):State {
  let quests=[...state.quests];
  for(const id of new Set(ids)) {
    const preset=PRESETS.find(p=>p.id===id);
    if(!preset)continue;
    const existing=findPresetQuest(quests,preset);
    if(existing) {
      // Enabling a paused task preserves its proof, rewards, schedule and completed status.
      if(!existing.enabled) quests=quests.map(q=>q.id===existing.id?{...q,enabled:true}:q);
      continue;
    }
    quests.push({id:crypto.randomUUID(),presetId:preset.id,name:preset.name,icon:preset.icon,
      category:preset.category,description:preset.description+(preset.help?` ${preset.help}`:''),
      coins:preset.coins,xp:preset.xp,days:days||preset.days,timer:preset.timer,
      photo:false,enabled:true,status:'active'});
  }
  return {...state,quests};
}
