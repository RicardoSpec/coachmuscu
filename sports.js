/* ============================================================================
   sports.js — Bibliothèque de sports & parcours de niveaux (0 → 10).

   DONNÉES PURES, zéro logique. Chargé AVANT app.js (comme data.js).
   Conçu pour des retraitements ciblés : UN bloc par sport (ancre nette,
   ex. SPORTS_LIB.nage), niveaux compacts → on peut lire/éditer un seul sport
   sans charger le reste.

   Schéma d'un sport :
     { name, icon, defaultOn, metric,            // métadonnées
       levels:[ {n, t, d, focus:[…]}, … ] }      // 11 paliers (n = 0..10)
   Schéma d'un palier :
     n     : niveau (0..10)
     t     : titre court du palier
     d     : compétence-repère en une phrase (« à ce niveau, tu sais… »)
     focus : 1–3 axes de travail prioritaires pour progresser vers le palier suivant

   Convention : quand un sport n'a que le t+d (échelle posée, contenu à détailler),
   focus peut être court ou vide — on étoffera sport par sport, sans toucher au reste.
   ========================================================================== */

var SPORTS_LIB = {

  order: ["muscu", "nage", "course", "velo", "escalade", "tennis"],

  /* ------------------------------------------------------------ MUSCULATION */
  muscu: {
    name: "Musculation", icon: "💪", defaultOn: false, metric: "niveau de force / structure d'entraînement",
    levels: [
      { n:0,  t:"Jamais entraîné",     d:"tu n'as pas d'habitude de renforcement.", focus:["Bouger régulièrement", "Gainage et mobilité de base"] },
      { n:1,  t:"Poids du corps",      d:"tu fais des squats, pompes (genoux ok), gainage.", focus:["Maîtriser squat / pompe / gainage", "Régularité 2×/sem"] },
      { n:2,  t:"Mouvements de base",  d:"tu connais les patrons : squat, charnière, poussée, tirage.", focus:["Technique avant charge", "Amplitude complète"] },
      { n:3,  t:"Charges légères",     d:"tu ajoutes haltères / élastiques proprement.", focus:["Progression de charge douce", "Tempo contrôlé"] },
      { n:4,  t:"Full-body structuré", d:"tu suis un programme full-body régulier.", focus:["3 séances/sem", "Surcharge progressive"] },
      { n:5,  t:"Split débutant",      d:"tu répartis haut / bas du corps.", focus:["Volume par groupe musculaire", "Récupération entre séances"] },
      { n:6,  t:"Split structuré",     d:"tu suis un split A/B/C/D périodisé.", focus:["Suivi des charges", "Gestion fatigue"] },
      { n:7,  t:"Périodisation",       d:"tu alternes blocs (volume / intensité).", focus:["Blocs de progression", "Décharge planifiée"] },
      { n:8,  t:"Force développée",    d:"tu travailles des charges lourdes en sécurité.", focus:["Force max (séries courtes)", "Technique sous charge"] },
      { n:9,  t:"Confirmé",            d:"tu ajustes ton programme selon tes points faibles.", focus:["Individualisation", "Points faibles ciblés"] },
      { n:10, t:"Avancé",              d:"tu maîtrises programmation et récupération sur le long terme.", focus:["Planification annuelle", "Optimisation récupération / nutrition"] }
    ]
  },

  /* -------------------------------------------------------------- NATATION */
  nage: {
    name: "Natation", icon: "🏊", defaultOn: false, metric: "distance en crawl continu (m)",
    levels: [
      { n:0,  t:"Non-nageur",            d:"tu n'es pas à l'aise la tête dans l'eau ou tu ne flottes pas encore.",
              focus:["Immersion et expiration dans l'eau (bulles)", "Flotter en étoile, ventre et dos", "Glisser après poussée au mur"] },
      { n:1,  t:"À l'aise dans l'eau",   d:"tu flottes, tu glisses et tu expires sous l'eau sans stress.",
              focus:["Battements de jambes avec planche", "Coulée ventrale bras tendus", "Respiration latérale posée"] },
      { n:2,  t:"25 m brasse",           d:"tu enchaînes 25 m en brasse coordonnée.",
              focus:["Temps de glisse entre chaque cycle", "Ciseau de jambes symétrique", "Nage relâchée, sans forcer"] },
      { n:3,  t:"200 m brasse",          d:"tu tiens 200 m en brasse sans t'arrêter.",
              focus:["Endurance : allonger la durée", "Économie : moins de coups pour la distance", "Introduction éducatifs crawl (avec tuba)"] },
      { n:4,  t:"Crawl 25 m",            d:"tu couvres 25 m en crawl, respiration encore laborieuse.",
              focus:["Respiration latérale 1 côté (tuba d'abord)", "Rotation des épaules (roulis)", "Battements réguliers, chevilles souples"] },
      { n:5,  t:"Crawl 100 m",           d:"tu tiens 100 m en crawl mais tu casses vite la coordination.",
              focus:["Respiration bilatérale (3 temps)", "Prise d'appui : main devant, coude haut", "Éducatifs rattrapé / poings fermés"] },
      { n:6,  t:"Crawl 400 m",           d:"tu enchaînes 400 m en crawl à allure tranquille.",
              focus:["Gestion du souffle sur la durée", "Alignement corps (pas de jambes qui coulent)", "Palmes pour sentir l'appui et la vitesse"] },
      { n:7,  t:"Crawl 750 m",           d:"tu tiens la moitié d'un M en crawl continu, à l'aise.",
              focus:["Régularité d'allure (négatif split)", "Virages / relances propres", "Nage en eau libre : repères, sighting"] },
      { n:8,  t:"Distance M (1500 m)",   d:"tu boucles 1500 m en crawl continu — objectif triathlon M atteint.",
              focus:["Tenir l'allure sur la distance de course", "Départ groupé et nage en peloton", "Combinaison néoprène : nage et transitions"] },
      { n:9,  t:"Crawl efficace",        d:"tu nages 1500 m avec un bon rendement et une allure maîtrisée.",
              focus:["Travail de seuil (intervalles)", "Technique fine : catch, gainage, timing", "Allures cibles au 100 m"] },
      { n:10, t:"Nageur confirmé",       d:"tu enchaînes plusieurs km, toutes allures, en eau libre comme en bassin.",
              focus:["Périodisation natation", "Vitesse et changements d'allure", "Autonomie totale en eau libre"] }
    ]
  },

  /* ---------------------------------------------------------------- COURSE */
  course: {
    name: "Course à pied", icon: "🏃", defaultOn: false, metric: "distance courue en continu (km)",
    levels: [
      { n:0,  t:"Sédentaire",       d:"courir quelques minutes t'essouffle.", focus:["Marche rapide régulière", "Alternance marche / trot"] },
      { n:1,  t:"5 min continu",    d:"tu trottines 5 min sans marcher.", focus:["Allonger les blocs de trot", "Respiration régulière"] },
      { n:2,  t:"2 km",             d:"tu cours 2 km sans t'arrêter.", focus:["Cadence ~170-180 ppm", "Foulée relâchée"] },
      { n:3,  t:"5 km",             d:"tu boucles 5 km en continu.", focus:["Endurance fondamentale", "Régularité de l'allure"] },
      { n:4,  t:"5 km en aisance",  d:"tu cours 5 km en parlant sans peine.", focus:["Volume hebdo progressif", "Introduction côtes / lignes droites"] },
      { n:5,  t:"10 km",            d:"tu tiens 10 km — distance course du triathlon M.", focus:["Sortie longue hebdo", "Allure spécifique 10 km"] },
      { n:6,  t:"10 km après vélo", d:"tu enchaînes 10 km en état de fatigue (brick).", focus:["Séances enchaînées vélo→course", "Gestion transition jambes"] },
      { n:7,  t:"Allures maîtrisées", d:"tu sais courir en zones (EF, seuil, VMA).", focus:["Fractionné court (VMA)", "Travail au seuil"] },
      { n:8,  t:"Semi (21 km)",     d:"tu cours un semi-marathon.", focus:["Sorties longues 90 min+", "Nutrition à l'effort"] },
      { n:9,  t:"Coureur confirmé", d:"tu tiens des allures sur toutes distances jusqu'au semi.", focus:["Périodisation", "Affûtage avant course"] },
      { n:10, t:"Marathon",         d:"tu boucles un marathon.", focus:["Volume élevé maîtrisé", "Stratégie de course"] }
    ]
  },

  /* ------------------------------------------------------------------ VÉLO */
  velo: {
    name: "Vélo", icon: "🚴", defaultOn: false, metric: "distance en continu (km)",
    levels: [
      { n:0,  t:"Débutant",        d:"tu roules peu et sans repères.", focus:["Prendre l'habitude de sorties régulières", "Position de base sur le vélo"] },
      { n:1,  t:"10 km",           d:"tu roules 10 km tranquillement.", focus:["Pédalage fluide (cadence 80-90)", "Utiliser les vitesses"] },
      { n:2,  t:"20 km",           d:"tu enchaînes 20 km sur le plat.", focus:["Endurance de selle", "Gestion de l'effort"] },
      { n:3,  t:"40 km",           d:"tu boucles 40 km — distance vélo du triathlon M.", focus:["Sortie longue hebdo", "Ravitaillement en roulant"] },
      { n:4,  t:"40 km en aisance",d:"tu tiens 40 km à bonne allure.", focus:["Position aéro (prolongateurs)", "Tenue d'allure"] },
      { n:5,  t:"Vallonné",        d:"tu passes des bosses sans exploser.", focus:["Grimper assis / en danseuse", "Gestion cardiaque en côte"] },
      { n:6,  t:"Enchaînement",    d:"tu roules puis cours (brick) sans casser.", focus:["Séances vélo→course", "Assouplir les jambes en fin de vélo"] },
      { n:7,  t:"Puissance (FTP)", d:"tu connais et travailles ta FTP.", focus:["Intervalles au seuil", "Test FTP régulier"] },
      { n:8,  t:"Sortie longue",   d:"tu roules 2-3 h en autonomie.", focus:["Nutrition longue durée", "Gestion mécanique de base"] },
      { n:9,  t:"Cycliste confirmé", d:"tu tiens des allures en zones sur tous terrains.", focus:["Périodisation", "Travail spécifique triathlon (contre-la-montre)"] },
      { n:10, t:"Longue distance", d:"tu enchaînes de très longues sorties, toutes conditions.", focus:["Volume élevé", "Stratégie d'allure sur épreuve"] }
    ]
  },

  /* -------------------------------------------------------------- ESCALADE */
  escalade: {
    name: "Escalade", icon: "🧗", defaultOn: false, metric: "cotation en tête (échelle française)",
    levels: [
      { n:0,  t:"Première fois",   d:"tu découvres le mur, en moulinette.", focus:["Sécurité : encordement, assurage", "Se déplacer en confiance"] },
      { n:1,  t:"4 en moulinette", d:"tu grimpes des voies faciles en moulinette.", focus:["Pousser sur les jambes", "Lire les prises"] },
      { n:2,  t:"5a",              d:"tu passes du 5a en moulinette.", focus:["Économie de bras", "Placements de pieds précis"] },
      { n:3,  t:"5c",              d:"tu grimpes du 5c à l'aise.", focus:["Gestion de la fatigue avant-bras", "Repos sur bonnes prises"] },
      { n:4,  t:"Tête niveau 5",   d:"tu grimpes en tête sur du 5.", focus:["Mousquetonner en sécurité", "Gérer le gaz / la chute"] },
      { n:5,  t:"6a",              d:"tu enchaînes du 6a.", focus:["Force de doigts (progressive)", "Mouvements dynamiques"] },
      { n:6,  t:"6b",              d:"tu passes du 6b en travaillant.", focus:["Lecture d'itinéraire", "Gainage et compression"] },
      { n:7,  t:"6c",              d:"tu grimpes du 6c.", focus:["Force spécifique doigts", "Endurance de résistance"] },
      { n:8,  t:"7a",              d:"tu réalises ton premier 7a.", focus:["Projet : travail de section", "Planification force / conti"] },
      { n:9,  t:"Grimpeur confirmé", d:"tu enchaînes dans le 7e degré.", focus:["Périodisation force", "Points faibles ciblés"] },
      { n:10, t:"Haut niveau",     d:"tu grimpes dans le 8e degré.", focus:["Préparation physique poussée", "Gestion mentale du projet"] }
    ]
  },

  /* ---------------------------------------------------------------- TENNIS */
  tennis: {
    name: "Tennis", icon: "🎾", defaultOn: false, metric: "niveau de jeu (auto-estimé)",
    levels: [
      { n:0,  t:"Débutant",        d:"tu découvres la raquette et l'échange.", focus:["Tenue de raquette", "Renvoyer la balle en coup droit"] },
      { n:1,  t:"Échange lent",    d:"tu maintiens un petit échange en coup droit.", focus:["Coup droit régulier", "Déplacements de base"] },
      { n:2,  t:"Coup droit + revers", d:"tu joues des deux côtés.", focus:["Revers (une ou deux mains)", "Se replacer au centre"] },
      { n:3,  t:"Service engagé",  d:"tu mets un service en jeu régulièrement.", focus:["Geste de service", "Première balle en jeu"] },
      { n:4,  t:"Point construit", d:"tu enchaînes quelques frappes dans un point.", focus:["Régularité en fond de court", "Varier les directions"] },
      { n:5,  t:"Match amical",    d:"tu joues des matchs et tiens le score.", focus:["Volée simple", "Tactique de base"] },
      { n:6,  t:"Effets",          d:"tu donnes du lift / du slice.", focus:["Lift en coup droit", "Slice de revers"] },
      { n:7,  t:"Jeu complet",     d:"tu maîtrises fond de court, montée, volée.", focus:["Montée au filet", "Schémas de jeu"] },
      { n:8,  t:"Compétiteur",     d:"tu joues en compétition club.", focus:["Gestion tactique du match", "Constance sous pression"] },
      { n:9,  t:"Confirmé",        d:"tu tiens un bon niveau de club.", focus:["Points forts à exploiter", "Préparation physique tennis"] },
      { n:10, t:"Haut niveau club", d:"tu joues les meilleurs tableaux régionaux.", focus:["Périodisation", "Préparation mentale"] }
    ]
  }

};

/* Gabarits de séance par sport (échauffement / retour au calme) — le bloc
   principal est fondé sur les axes de focus du palier. */
var SPORT_TPL = {
  _default:{warm:"10 min d'échauffement progressif (mobilité + montée en intensité).", cool:"5 min de retour au calme + étirements des muscles sollicités."},
  nage:{warm:"300 m souple + 4×50 m éducatifs (battements, rattrapé).", cool:"200 m dos / récupération, respiration ample."},
  course:{warm:"10 min de footing lent + gammes (talons-fesses, montées de genoux).", cool:"5 min de marche + étirements mollets / ischios."},
  velo:{warm:"15 min en montée de cadence progressive.", cool:"10 min en moulinette souple."},
  escalade:{warm:"Mobilité épaules / poignets + 2-3 voies faciles pour chauffer les doigts.", cool:"Descente en moulinette + étirements avant-bras et dos."},
  tennis:{warm:"Mini-tennis + déplacements progressifs (5-10 min).", cool:"Quelques échanges tranquilles + étirements épaule / poignet."}
};
if(typeof window!=="undefined")window.SPORT_TPL=SPORT_TPL;
