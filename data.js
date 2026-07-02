/* =========================================================
   Coach Muscu — data.js
   Données uniquement (aucune logique).
   Doit être chargé AVANT app.js.
   ========================================================= */

/* ---------- Mes autres apps (menu lanceur ☰) ----------
   Pour activer une app à venir : passe ready:true et ajoute son url.
   --------------------------------------------------------- */
var APPS = [
  {name:"Suivi muscu",                icon:"💪", here:true},
  {name:"L'Atelier — orthographe",    icon:"✏️", ready:true, url:"https://ricardospec.github.io/Lateliergram/"},
  {name:"The Workbook — anglais",     icon:"🇬🇧", ready:true, url:"https://ricardospec.github.io/English-Fly/"},
  {name:"Mémoire & révisions — DSCG", icon:"📚", ready:true, url:"https://ricardospec.github.io/Mouche-Universit-/"},
  {name:"Grand livre — budget",       icon:"💶", ready:true, url:"https://ricardospec.github.io/Budgetisation/"},
  {name:"Espagnol",                   icon:"🇪🇸", ready:false}
];

/* ---------- Compléments : routine quotidienne (groupée par moment) ----------
   when  : créneau de prise (voir SUPP_SLOTS ci-dessous).
   prot  : g de protéines ajoutés au total du jour quand le complément est coché (whey).
   Retirer un complément : supprime sa ligne. En ajouter : copie une ligne.
   ---------------------------------------------------------------------------- */
var SUPP_SLOTS = [
  {id:"matin",  label:"Matin, à jeun"},
  {id:"repas",  label:"À un repas (matin ou midi)"},
  {id:"seance", label:"Après la séance (ou en collation)"},
  {id:"soir",   label:"Le soir, après le dîner"}
];
var SUPPS = [
  {id:"probio",    name:"Pure Bio² (probiotiques)", when:"matin",  dose:"1 à 2 gélules, avant le petit-déj"},
  {id:"spiruline", name:"Spiruline (Hainan)",       when:"repas",  dose:"selon l'étiquette"},
  {id:"oyster",    name:"Poudre d'huître",          when:"repas",  dose:"selon l'étiquette"},
  {id:"omega3",    name:"Oméga 3",                  when:"repas",  dose:"3 capsules pendant le repas"},
  {id:"whey",      name:"Whey Isolate Native",      when:"seance", dose:"30 g (≈ 2 dosettes)", prot:28, kcal:115},
  {id:"fenugrec",  name:"Fenugrec",                 when:"soir",   dose:"4 gélules après le repas"},
  {id:"magnesium", name:"Magnésium bisglycinate",   when:"soir",   dose:"selon l'étiquette"}
];

/* ---------- BLOC 1 — Construction (27 juin → 31 juillet) ---------- */
var PROGRAM = {
  A:{title:"Séance A — Haut (force) + abdos", sub:"Haut · force", exos:[
    {id:"a1",name:"Développé couché (haltères/barre)",target:"4 × 6-8",sets:4,unit:"reps",help:"Allongé, pousser la charge du torse vers le haut, omoplates serrées. <b>Cible :</b> pectoraux, épaules, triceps."},
    {id:"a2",name:"Tractions pronation",target:"4 × max",sets:4,unit:"reps",help:"Paumes vers l'avant, se tirer jusqu'au menton au-dessus de la barre. <b>Cible :</b> dos (largeur), biceps."},
    {id:"a3",name:"Développé militaire (debout/assis)",target:"3 × 8-10",sets:3,unit:"reps",help:"Pousser la barre au-dessus de la tête, dos gainé. <b>Cible :</b> épaules."},
    {id:"a4",name:"Rowing barre / machine",target:"3 × 8-10",sets:3,unit:"reps",help:"Buste penché, tirer la barre vers le ventre. <b>Cible :</b> dos (épaisseur)."},
    {id:"a5",name:"Élévations latérales",target:"3 × 12-15",sets:3,unit:"reps",help:"Lever les bras sur les côtés jusqu'à l'horizontale. <b>Cible :</b> épaules latérales (largeur)."},
    {id:"a6",name:"Relevés de jambes suspendus",target:"3 × 12-15",sets:3,unit:"reps",help:"Suspendu, monter les jambes sans balancer. <b>Cible :</b> abdominaux bas."}
  ]},
  B:{title:"Séance B — Bas (allégé) + core", sub:"Bas · core", exos:[
    {id:"b1",name:"Squat barre",target:"4 × 6-8",sets:4,unit:"reps",help:"Barre sur le haut du dos, descendre fesses en arrière jusqu'aux cuisses parallèles. <b>Cible :</b> cuisses, fessiers."},
    {id:"b2",name:"Soulevé de terre roumain",target:"3 × 8-10",sets:3,unit:"reps",help:"Jambes quasi tendues, fesses en arrière, dos droit. <b>Cible :</b> ischios, bas du dos, fessiers."},
    {id:"b3",name:"Mollets debout",target:"4 × 15",sets:4,unit:"reps",help:"Monter sur la pointe des pieds, redescendre lentement. <b>Cible :</b> mollets."},
    {id:"b4",name:"Crunch à la poulie (lesté)",target:"3 × 12-15",sets:3,unit:"reps",help:"À genoux, enrouler le buste vers le sol. <b>Cible :</b> abdominaux."},
    {id:"b5",name:"Gainage planche",target:"3 × 45 s",sets:3,unit:"sec",help:"Corps droit sur avant-bras et pointes de pieds. <b>Cible :</b> sangle abdominale."},
    {id:"b6",name:"Gainage latéral",target:"3 × 30 s/côté",sets:3,unit:"sec",help:"Sur le côté, appui sur un avant-bras, hanches hautes. <b>Cible :</b> obliques."}
  ]},
  C:{title:"Séance C — Haut (volume) + abdos", sub:"Haut · volume", exos:[
    {id:"c1",name:"Développé incliné haltères",target:"4 × 8-10",sets:4,unit:"reps",help:"Banc incliné, pousser les haltères vers le haut. <b>Cible :</b> haut des pectoraux."},
    {id:"c2",name:"Tirage vertical poulie",target:"4 × 10-12",sets:4,unit:"reps",help:"Tirer la barre vers le haut de la poitrine, coudes vers le bas. <b>Cible :</b> dos (largeur)."},
    {id:"c3",name:"Dips / développé machine",target:"3 × 10-12",sets:3,unit:"reps",help:"Descendre coudes pliés puis remonter (barres parallèles ou machine). <b>Cible :</b> bas des pectoraux, triceps."},
    {id:"c4",name:"Face pull (poulie)",target:"3 × 15",sets:3,unit:"reps",help:"Tirer la corde vers le visage, coudes hauts. <b>Cible :</b> épaules arrière, posture."},
    {id:"c5",name:"Curl + extension triceps",target:"3 × 12",sets:3,unit:"reps",help:"En superset : curl biceps puis extension triceps. <b>Cible :</b> bras (biceps + triceps)."},
    {id:"c6",name:"Crunch lesté / relevés de jambes",target:"3 × 15",sets:3,unit:"reps",help:"Travail abdominal lesté ou relevés de jambes. <b>Cible :</b> abdominaux."}
  ]},
  D:{title:"Séance D — Haut (accessoire) + abdos", sub:"Haut · accessoire", exos:[
    {id:"d1",name:"Rowing haltère 1 bras",target:"3 × 10-12",sets:3,unit:"reps",help:"Un genou sur le banc, tirer l'haltère vers la hanche. <b>Cible :</b> dos."},
    {id:"d2",name:"Écarté poulie / pec deck",target:"3 × 12-15",sets:3,unit:"reps",help:"Rapprocher les bras devant soi en arc de cercle. <b>Cible :</b> pectoraux (étirement)."},
    {id:"d3",name:"Élévations latérales",target:"4 × 15",sets:4,unit:"reps",help:"Lever les bras sur les côtés jusqu'à l'horizontale. <b>Cible :</b> épaules latérales."},
    {id:"d4",name:"Extension triceps à la poulie (corde)",target:"3 × 12-15",sets:3,unit:"reps",help:"Coudes fixes le long du corps, tendre les bras vers le bas puis écarter la corde en fin de course. <b>Cible :</b> triceps (les épaules arrière sont déjà couvertes en séance C)."},
    {id:"d5",name:"Curl marteau",target:"3 × 12",sets:3,unit:"reps",help:"Curl avec les paumes face à face (prise marteau). <b>Cible :</b> biceps, avant-bras."},
    {id:"d6",name:"Roue abdos / planche dynamique",target:"3 × 10-12",sets:3,unit:"reps",help:"Roue abdominale ou planche dynamique. <b>Cible :</b> sangle abdominale (avancé)."}
  ]}
};

/* ---------- BLOC 2 — Août (focus plage) ---------- */
var PROGRAM2 = {
  A:{title:"Séance A — Pecs & épaules (force)", sub:"Pousser", exos:[
    {id:"a1",name:"Développé couché barre",target:"4 × 6-8",sets:4,unit:"reps",help:"Pousser la barre du torse vers le haut, omoplates serrées. <b>Cible :</b> pectoraux, épaules, triceps."},
    {id:"a2",name:"Développé militaire barre",target:"4 × 6-8",sets:4,unit:"reps",help:"Barre poussée au-dessus de la tête, debout, dos gainé. <b>Cible :</b> épaules (force)."},
    {id:"a3",name:"Développé incliné haltères",target:"3 × 8-10",sets:3,unit:"reps",help:"Banc incliné, pousser les haltères vers le haut. <b>Cible :</b> haut des pectoraux."},
    {id:"a4",name:"Élévations latérales",target:"4 × 12-15",sets:4,unit:"reps",help:"Lever les bras sur les côtés à l'horizontale. <b>Cible :</b> épaules latérales (largeur)."},
    {id:"a5",name:"Oiseau (épaules arrière)",target:"3 × 15",sets:3,unit:"reps",help:"Buste penché, écarter les haltères sur les côtés. <b>Cible :</b> épaules arrière, posture."},
    {id:"a6",name:"Relevés de jambes lestés",target:"3 × 12",sets:3,unit:"reps",help:"Suspendu ou allongé, monter les jambes sans balancer. <b>Cible :</b> abdominaux bas."}
  ]},
  B:{title:"Séance B — Bas & gainage", sub:"Jambes", exos:[
    {id:"b1",name:"Presse à cuisses",target:"4 × 8-10",sets:4,unit:"reps",help:"Pousser la charge avec les jambes, amplitude contrôlée. <b>Cible :</b> cuisses, fessiers."},
    {id:"b2",name:"Soulevé de terre roumain",target:"3 × 8-10",sets:3,unit:"reps",help:"Jambes quasi tendues, fesses en arrière, dos droit. <b>Cible :</b> ischios, bas du dos."},
    {id:"b3",name:"Fentes marchées haltères",target:"3 × 12/jambe",sets:3,unit:"reps",help:"Grands pas en fente, genou vers le sol. <b>Cible :</b> cuisses, fessiers, équilibre."},
    {id:"b4",name:"Mollets debout",target:"4 × 15",sets:4,unit:"reps",help:"Monter sur la pointe des pieds, redescendre lentement. <b>Cible :</b> mollets."},
    {id:"b5",name:"Roue abdos",target:"3 × 10-12",sets:3,unit:"reps",help:"À genoux, rouler vers l'avant dos droit, revenir. <b>Cible :</b> abdominaux (avancé)."},
    {id:"b6",name:"Gainage planche",target:"3 × 60 s",sets:3,unit:"sec",help:"Corps droit sur avant-bras et pointes de pieds. <b>Cible :</b> sangle abdominale."}
  ]},
  C:{title:"Séance C — Dos & bras", sub:"Tirer", exos:[
    {id:"c1",name:"Tractions lestées",target:"4 × 6-8",sets:4,unit:"reps",help:"Se tirer menton au-dessus de la barre, lest si besoin. <b>Cible :</b> dos (largeur), biceps."},
    {id:"c2",name:"Tirage horizontal poulie",target:"4 × 10-12",sets:4,unit:"reps",help:"Tirer la poignée vers le ventre, serrer les omoplates. <b>Cible :</b> dos (épaisseur)."},
    {id:"c3",name:"Pull-over haltère",target:"3 × 12",sets:3,unit:"reps",help:"Allongé, descendre l'haltère derrière la tête bras semi-tendus. <b>Cible :</b> dorsaux, pectoraux, cage."},
    {id:"c4",name:"Curl barre",target:"3 × 8-10",sets:3,unit:"reps",help:"Fléchir les coudes, barre vers les épaules, sans balancer. <b>Cible :</b> biceps."},
    {id:"c5",name:"Extension triceps poulie",target:"3 × 10-12",sets:3,unit:"reps",help:"Tendre les bras vers le bas contre la poulie. <b>Cible :</b> triceps."},
    {id:"c6",name:"Crunch à la poulie",target:"3 × 15",sets:3,unit:"reps",help:"À genoux, enrouler le buste vers le sol. <b>Cible :</b> abdominaux (lesté = progression)."}
  ]},
  D:{title:"Séance D — Épaules & finition", sub:"Détails", exos:[
    {id:"d1",name:"Développé épaules haltères",target:"4 × 8-10",sets:4,unit:"reps",help:"Pousser les haltères au-dessus de la tête, assis. <b>Cible :</b> épaules."},
    {id:"d2",name:"Élévations latérales (drop set)",target:"4 × 15",sets:4,unit:"reps",help:"Séries longues, baisse la charge sans repos en fin de série. <b>Cible :</b> épaules latérales."},
    {id:"d3",name:"Élévations frontales",target:"3 × 12",sets:3,unit:"reps",help:"Lever les bras devant soi jusqu'à l'horizontale. <b>Cible :</b> épaules avant."},
    {id:"d4",name:"Curl marteau",target:"3 × 12",sets:3,unit:"reps",help:"Curl avec les paumes face à face (prise marteau). <b>Cible :</b> biceps, avant-bras."},
    {id:"d5",name:"Dips lestés",target:"3 × 8-10",sets:3,unit:"reps",help:"Sur barres parallèles, descendre coudes pliés, remonter. <b>Cible :</b> bas des pectoraux, triceps."},
    {id:"d6",name:"Gainage latéral",target:"3 × 40 s/côté",sets:3,unit:"sec",help:"Sur le côté, appui sur un avant-bras, hanches hautes. <b>Cible :</b> obliques."}
  ]}
};

/* ---------- Blocs & codes ---------- */
var PROGRAM_BLOCKS = {
  b1:{name:"Bloc 1 — Construction", short:"B1", weeks:5, prog:PROGRAM},
  b2:{name:"Bloc 2 — Août (plage)", short:"B2", weeks:4, prog:PROGRAM2}
};
var BLOCK_ORDER = ["b1","b2"];
var CODES = ["A","B","C","D"];

/* ---------- Dates d'ancrage ---------- */
var MUSCU_START = "2026-06-27";  /* Bloc 1, semaine 1 */
var TRI_START   = "2026-07-06";  /* Triathlon, semaine 1 (semaine 10 = course 11-13 sept) */

/* ---------- Agenda : modèle de semaine ----------
   Pour chaque jour : {type:"muscu", code:"A"} (A/B/C/D) ou {type:"tri", disc:"nat"} (nat/velo/course),
   ou null pour un jour sans séance prévue. Une séance ne s'affiche que si le bloc/plan est actif à cette date.
   Réorganise librement : déplace une séance en changeant le jour. -------------------------------------- */
var TRAIN_TEMPLATE = {
  lun:{type:"muscu", code:"A"},
  mar:{type:"tri",   disc:"nat"},
  mer:{type:"muscu", code:"B"},
  jeu:{type:"tri",   disc:"velo"},
  ven:{type:"muscu", code:"C"},
  sam:{type:"tri",   disc:"course"},
  dim:{type:"muscu", code:"D"}
};

/* ---------- États possibles d'un jour (couleurs gérées dans le CSS) ---------- */
/* Vocabulaire de jours COMMUN à toutes les apps (musculation, révisions DSCG…).
   Le type de base (semaine / week-end) se déduit du jour de la semaine ;
   ces types sont les SURCHARGES manuelles, partagées entre apps. train:false => bloque l'entraînement. */
var DAY_TYPES = [
  {id:"",        label:"Normal",          icon:"",   train:true },
  {id:"cours",   label:"Cours / travail", icon:"📚", train:true },
  {id:"conge",   label:"Congé",           icon:"🏖️", train:true },
  {id:"repos",   label:"Repos",           icon:"😴", train:false},
  {id:"indispo", label:"Indisponible",    icon:"🚫", train:false}
];
/* Rétro-compatibilité : anciennes clés Coach Muscu → vocabulaire commun */
var DAY_TYPE_MIGRATE = { occupe:"indispo", vacances:"conge" };

/* Planning importé du Gsheet « Avancement » (projection des jours dispo jusqu'au 31/08).
   Semé UNE FOIS dans le store partagé (sans écraser un jour déjà défini) — modifiable ensuite
   jour par jour depuis le calendrier. conge = jour libre (révision 6 h, entraînement ok) ;
   indispo = ni révision ni entraînement. */
var PLAN_SEED = {
  "2026-07-13":"conge","2026-07-14":"conge",
  "2026-07-27":"conge","2026-07-28":"conge","2026-07-29":"conge","2026-07-30":"conge","2026-07-31":"conge",
  "2026-08-03":"conge","2026-08-04":"conge",
  "2026-08-08":"indispo","2026-08-09":"indispo",
  "2026-08-13":"conge","2026-08-14":"conge","2026-08-17":"conge"
};

/* ---------- Échéances marquées sur le calendrier ---------- */
var DEADLINES = [
  {date:"2026-07-25", label:"Départ Vercors",          icon:"🚆", short:"Départ"},
  {date:"2026-07-27", label:"Objectif forme / plage",  icon:"🏖️", short:"Forme"},
  {date:"2026-09-11", label:"Triathlon Dinard",        icon:"🏊", short:"Triathlon"}
];

/* ---------- Plan Triathlon Dinard — Distance Olympique, 10 semaines, 3 séances/sem.
   Résumé des volumes/séances (détails complets dans le Drive). ---------- */
var TRI = [
 {w:1, nat:{t:"1200 m", d:"8×50 m (alterné amplitude/vélocité) · 4×100 m pull buoy (resp. 3 temps) · 200 m au choix."}, velo:{t:"1h15", d:"Petit plateau, travail de vélocité (~90 tr/min)."}, course:{t:"40′", d:"20′ footing · 10′ éducatifs (montées de genoux, talons-fesses) · 10′ footing."}},
 {w:2, nat:{t:"1400 m", d:"300 m (crawl/dos/brasse) · 6×100 m technique · 300 m pull buoy · 200 m (50 crawl/50 dos)."}, velo:{t:"1h30", d:"Petit plateau, vélocité ; danseuse/debout dans les bosses."}, course:{t:"45′", d:"25′ footing · éducatifs · footing."}},
 {w:3, nat:{t:"1600 m", d:"6×100 m (crawl/pull buoy) · 8×50 m (15 m sprint/35 m lent) · 2×200 m resp. frontale · 200 m."}, velo:{t:"1h45", d:"2 blocs de 10′ en force (grand plateau/petit pignon), r 5′ en vélocité."}, course:{t:"50′", d:"20′ footing · 20′ avec sprint 15 s toutes les 2′ · 10′ footing."}},
 {w:4, nat:{t:"1800 m", d:"400 m pull buoy · 8×50 m (battements/amplitude) · 6×100 m (25 vite/75 lent) · 300 m resp. frontale · 100 m."}, velo:{t:"2h00", d:"Grand plateau : bloc 12′ force + 6 sprints 15 s toutes les 4′, fin en endurance."}, course:{t:"50′", d:"20′ footing · 8 accélérations en côte (~100 m), récup en descente · footing."}},
 {w:5, nat:{t:"2000 m", d:"4×150 m · 8×50 m vite · 400 m pull buoy (resp. 3/5 temps) · 200 m resp. frontale · 200 m."}, velo:{t:"2h00 +15′", d:"6 bosses de 500-800 m (petit plateau), récup en descente. Puis enchaîne 15′ de course."}, course:{t:"50′", d:"20′ footing · 2×8′ (30 s vite/30 s lentes) · footings entre les blocs."}},
 {w:6, nat:{t:"2000 m", d:"400 m alterné · 6×50 m amplitude · 800 m en pyramide (25→100→25, vite/lent) · 300 m pull buoy · 200 m."}, velo:{t:"2h00 +20′", d:"Parcours vallonné, braquet selon le relief. Puis enchaîne 20′ de footing."}, course:{t:"50′", d:"2×10′ (1 min vite/1 min lente) · footings entre."}},
 {w:7, nat:{t:"2000 m", d:"12×50 m variés · 300 m pull buoy resp. frontale · 5×200 m allure course (r 30″) · 100 m."}, velo:{t:"2h00 +20′", d:"Parcours vallonné. Puis enchaîne 20′ de footing."}, course:{t:"50′", d:"3×10′ allure course (r 10′) · 3×5′ allure 10 km (r 2′) · footing."}},
 {w:8, nat:{t:"2000 m", d:"500 m enchaîné (crawl/dos/brasse) · 500 m pull buoy · 500 m allure course · 500 m enchaîné."}, velo:{t:"2h00 +30′", d:"Parcours vallonné souple. Puis enchaîne 30′ (15′ allure course/15′ footing)."}, course:{t:"50′", d:"20′ footing · 5×(2′ vite/2′ lentes) · 10′ footing."}},
 {w:9, nat:{t:"1500 m", d:"300 m au choix · 1000 m pull buoy · 200 m au choix.", taper:true}, velo:{t:"1h30 +20′", d:"Vallonné souple, accélérations dans les bosses. Puis 20′ (10′ allure/10′ footing)."}, course:{t:"50′", d:"20′ footing · 5×(2′ vite/2′ lentes) · 10′ footing."}},
 {w:10, nat:{t:"1000 m", d:"400 m (crawl/dos/crawl/brasse) · 4×100 m allure course (r 30″) · 200 m au choix.", taper:true}, velo:{t:"1h00 +20′", d:"Parcours vallonné léger. Puis enchaîne 20′ de footing."}, course:{t:"30′", d:"15′ footing · 5′ allure course · 10′ footing. Dernière semaine !"}}
];
var TRI_DISC = [["nat","Natation"],["velo","Vélo"],["course","Course"]];

/* ---------- Échelle de Bristol (état des selles) ---------- */
var BRISTOL = [
  {v:"1", label:"Type 1 — billes dures séparées (constipation)"},
  {v:"2", label:"Type 2 — en saucisse, grumeleuse"},
  {v:"3", label:"Type 3 — en saucisse, craquelée"},
  {v:"4", label:"Type 4 — lisse et molle (idéal)"},
  {v:"5", label:"Type 5 — morceaux mous, bords nets"},
  {v:"6", label:"Type 6 — pâteux, bords irréguliers"},
  {v:"7", label:"Type 7 — liquide (diarrhée)"}
];

/* ---------- Journal : options ---------- */
var SPORTS    = ["Course","Vélo","Natation","Escalade","Muscu","Repos","Autre"];
var PROG_OPTS = ["","Oui","Partiellement","Non","Jour de repos"];
