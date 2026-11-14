// Presentation only: filtering never changes a reward's price or approval rules.
export function rewardPresentation(name:string,description=''):{category:string;icon:string}{
 const text=`${name} ${description}`.toLowerCase();
 if(/movie|cinema/.test(text))return {category:'Screen Time',icon:'🎬'};
 if(/gaming|game time|tablet|screen|video/.test(text))return {category:'Screen Time',icon:'🎮'};
 if(/ice.?cream/.test(text))return {category:'Treats',icon:'🍦'};
 if(/cookie|bakery/.test(text))return {category:'Treats',icon:'🍪'};
 if(/treat|pizza|meal|snack|cake|sweet|chocolate/.test(text))return {category:'Treats',icon:'🍰'};
 return {category:'Goals',icon:/lego|toy|space/.test(text)?'🚀':'🎁'};
}
