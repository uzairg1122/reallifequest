export const parentLanguages = {en:'English',es:'Español',nl:'Nederlands',fr:'Français',de:'Deutsch',pt:'Português'} as const;
export type ParentLanguage = keyof typeof parentLanguages;
const storageKey = 'rlq_parent_language';
const messages: Record<Exclude<ParentLanguage,'en'>, Readonly<Record<string,string>>> = {
 es: {"Settings":"Ajustes","Language":"Idioma","Sound & Music":"Sonido y música","In-app Reminders":"Recordatorios en la app","Help & Support":"Ayuda y soporte","About App":"Acerca de la app","Privacy policy":"Política de privacidad","Account deletion":"Eliminar cuenta","Log Out":"Cerrar sesión","Contact support":"Contactar con soporte","Home":"Inicio","Children":"Hijos","Quests":"Misiones","More":"Más","Your Family":"Tu familia","Quest Review":"Revisar misiones","Notifications":"Notificaciones","Your children":"Tus hijos","Review quests":"Revisar misiones","Assign quest":"Asignar misión","Invite child":"Invitar a un hijo","Rewards":"Recompensas","Good morning":"Buenos días","Good afternoon":"Buenas tardes","Good evening":"Buenas noches","Total XP":"XP total","Coins":"Monedas","Preferences":"Preferencias","Pending":"Pendientes","Completed":"Completadas","All":"Todas"},
 nl: {"Settings":"Instellingen","Language":"Taal","Sound & Music":"Geluid en muziek","In-app Reminders":"Herinneringen in de app","Help & Support":"Hulp en ondersteuning","About App":"Over de app","Privacy policy":"Privacybeleid","Account deletion":"Account verwijderen","Log Out":"Uitloggen","Contact support":"Contact opnemen","Home":"Start","Children":"Kinderen","Quests":"Missies","More":"Meer","Your Family":"Je gezin","Quest Review":"Missies beoordelen","Notifications":"Meldingen","Your children":"Je kinderen","Review quests":"Missies beoordelen","Assign quest":"Missie toewijzen","Invite child":"Kind uitnodigen","Rewards":"Beloningen","Good morning":"Goedemorgen","Good afternoon":"Goedemiddag","Good evening":"Goedenavond","Total XP":"Totale XP","Coins":"Munten","Preferences":"Voorkeuren","Pending":"In afwachting","Completed":"Voltooid","All":"Alle"},
 fr: {"Settings":"Paramètres","Language":"Langue","Sound & Music":"Son et musique","In-app Reminders":"Rappels dans l’application","Help & Support":"Aide et assistance","About App":"À propos","Privacy policy":"Politique de confidentialité","Account deletion":"Supprimer le compte","Log Out":"Se déconnecter","Contact support":"Contacter l’assistance","Home":"Accueil","Children":"Enfants","Quests":"Missions","More":"Plus","Your Family":"Votre famille","Quest Review":"Vérifier les missions","Notifications":"Notifications","Your children":"Vos enfants","Review quests":"Vérifier les missions","Assign quest":"Attribuer une mission","Invite child":"Inviter un enfant","Rewards":"Récompenses","Good morning":"Bonjour","Good afternoon":"Bon après-midi","Good evening":"Bonsoir","Total XP":"XP totale","Coins":"Pièces","Preferences":"Préférences","Pending":"En attente","Completed":"Terminées","All":"Toutes"},
 de: {"Settings":"Einstellungen","Language":"Sprache","Sound & Music":"Ton und Musik","In-app Reminders":"Erinnerungen in der App","Help & Support":"Hilfe und Support","About App":"Über die App","Privacy policy":"Datenschutzerklärung","Account deletion":"Konto löschen","Log Out":"Abmelden","Contact support":"Support kontaktieren","Home":"Start","Children":"Kinder","Quests":"Missionen","More":"Mehr","Your Family":"Deine Familie","Quest Review":"Missionen prüfen","Notifications":"Benachrichtigungen","Your children":"Deine Kinder","Review quests":"Missionen prüfen","Assign quest":"Mission zuweisen","Invite child":"Kind einladen","Rewards":"Belohnungen","Good morning":"Guten Morgen","Good afternoon":"Guten Tag","Good evening":"Guten Abend","Total XP":"Gesamt-XP","Coins":"Münzen","Preferences":"Einstellungen","Pending":"Offen","Completed":"Abgeschlossen","All":"Alle"},
 pt: {"Settings":"Configurações","Language":"Idioma","Sound & Music":"Som e música","In-app Reminders":"Lembretes no app","Help & Support":"Ajuda e suporte","About App":"Sobre o app","Privacy policy":"Política de privacidade","Account deletion":"Excluir conta","Log Out":"Sair","Contact support":"Contatar suporte","Home":"Início","Children":"Filhos","Quests":"Missões","More":"Mais","Your Family":"Sua família","Quest Review":"Revisar missões","Notifications":"Notificações","Your children":"Seus filhos","Review quests":"Revisar missões","Assign quest":"Atribuir missão","Invite child":"Convidar uma criança","Rewards":"Recompensas","Good morning":"Bom dia","Good afternoon":"Boa tarde","Good evening":"Boa noite","Total XP":"XP total","Coins":"Moedas","Preferences":"Preferências","Pending":"Pendentes","Completed":"Concluídas","All":"Todas"},
};

export function readParentLanguage(): ParentLanguage {
 const saved=localStorage.getItem(storageKey);
 return saved && Object.hasOwn(parentLanguages,saved) ? saved as ParentLanguage : 'en';
}

export function saveParentLanguage(language:ParentLanguage) {
 localStorage.setItem(storageKey,language);
 window.dispatchEvent(new Event('rlq-language-change'));
}

export function parentText(language:ParentLanguage,text:string) {
 return language==='en' ? text : messages[language][text] ?? (details[language] as Record<string,string>)[text] ?? text;
}
import {useSyncExternalStore} from 'react';
import details from './locale-details.json';

function subscribeLanguage(listener:()=>void) {
 window.addEventListener('rlq-language-change',listener);
 return ()=>window.removeEventListener('rlq-language-change',listener);
}

export function useAppLanguage(){
 return useSyncExternalStore(subscribeLanguage,readParentLanguage,()=> 'en' as ParentLanguage);
}

export function useAppText(){
 const language=useAppLanguage();
 return (text:string)=>parentText(language,text);
}
