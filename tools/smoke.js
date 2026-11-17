/* Test de fumée jsdom de Coach Muscu (outil de dev, non chargé par l'app).
   Usage, depuis la racine du dépôt :  npm i jsdom --no-save && node tools/smoke.js
   Principe : boot de index.html sans ses <script src>, injection de data.js / sports.js / app.js, état de départ fictif,
   puis clics réels. Les renderX ne sont pas exposés : tout passe par le DOM. Écritures : on force le flush via « pagehide ». */
process.env.TZ="Europe/Paris";
const {JSDOM}=require("jsdom"),fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..")+path.sep,rd=f=>fs.readFileSync(R+f,"utf8");
const HTML=rd("index.html").replace(/<script[^>]*src=[^>]*><\/script>/g,""),SRC=["data.js","sports.js","app.js"].map(rd);
let fails=0;const ok=(c,m)=>{console.log((c?"✓ ":"✗ ")+m);if(!c)fails++;};const wait=ms=>new Promise(r=>setTimeout(r,ms));
function seed(o){o=o||{};const s={sessions:{},days:{},tri:{"1_nat":{done:true,date:"2026-08-20"}},config:{activities:{muscu:{enabled:true,start:"2026-06-27",name:"Objectif développement",desc:""},tri:{enabled:true,start:"2026-08-17",name:"Triathlon",desc:""}},
  objectivesCustom:[{id:"obj-muscu-1",name:"Objectif développement",icon:"💪",sports:["muscu"],deadline:o.dl||"",kind:"sport",musc:true},{id:"obj-tri-1",name:"Triathlon Dinard",icon:"🏊",sports:["nage","velo","course"],deadline:"2026-09-13",kind:"sport",tri:true}],
  sportsUser:{nage:{on:true,cur:0,target:2,minutes:45,days:[],lvlBase:0,deadline:"",tickets:3},velo:{on:true,cur:0,target:0,minutes:45,days:[],lvlBase:0,deadline:""},course:{on:true,cur:0,target:0,minutes:45,days:[],lvlBase:0,deadline:""},muscu:{on:true,cur:0,target:0,minutes:45,days:[],lvlBase:0,deadline:o.dl||""}}}};
  const PB={b1:[5,"ABCD"],b2:[4,"ABCD"],b3:[8,"ABCD"],b4:[12,"ABCDE"],b5:[10,"ABCDEF"],b6:[2,"AC"]};
  for(const b in PB)for(let w=1;w<=PB[b][0];w++)for(const c of PB[b][1])s.sessions[(b==="b1"?w+"_"+c:b+"_"+w+"_"+c)]={done:true,date:"2026-11-01",sets:{}};
  return JSON.stringify(s);}
function boot(ls,pre){return new Promise(res=>{const errs=[];
  const dom=new JSDOM(HTML,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://x.test/",beforeParse(w){w.localStorage.setItem("suiviMuscu_v1",ls);if(pre)pre(w);
    w.requestAnimationFrame=f=>setTimeout(f,0);w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
    w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.prompt=()=>"";w.addEventListener("error",e=>errs.push(e.message));}});
  const d=dom.window.document;SRC.forEach(s=>{const e=d.createElement("script");e.textContent=s;d.body.appendChild(e);});
  setTimeout(()=>res({w:dom.window,d,errs,st(){dom.window.dispatchEvent(new dom.window.Event("pagehide"));return JSON.parse(dom.window.localStorage.getItem("suiviMuscu_v1"));}}),400);});}
const tab=(d,v)=>d.querySelector('.tab[data-view="'+v+'"]').click();
const openSet=(d,grp,sec)=>{d.getElementById("settingsBtn").click();const g=d.querySelector('.set-grptog[data-grp="'+grp+'"]');if(g)g.click();const t=d.querySelector('.set-sectog[data-sec="'+sec+'"]');if(t)t.click();};
(async()=>{
  // ---- 1. démarrage, bloc B7, échéance dépassée ----
  let a=await boot(seed({dl:"2026-07-27"}));
  ok(a.errs.length===0,"démarrage sans erreur JS");
  tab(a.d,"v-sport");
  const nx=a.d.querySelector(".cell.next");ok(nx&&nx.getAttribute("data-b")==="b7"&&nx.getAttribute("data-w")==="1","après B6 la prochaine séance est B7 S1");
  ok([...a.d.querySelectorAll(".cell[data-c]")].filter(c=>c.getAttribute("data-b")==="b7").length===12,"B7 : 12 séances (A,C × 6 sem.)");
  ok(/taille en V/.test(a.d.body.textContent),"encart d'objectif du bloc affiché");
  const mt=a.d.getElementById("muscuTitle");ok(!!mt.querySelector(".dl-exp"),"échéance dépassée : pastille visible");
  const inp=mt.querySelector(".dl-push");inp.value="2027-02-01";inp.dispatchEvent(new a.w.Event("change",{bubbles:true}));
  ok(a.st().config.objectivesCustom[0].deadline==="2027-02-01"&&!a.d.getElementById("muscuTitle").querySelector(".dl-exp"),"Repousser : date mise à jour, pastille retirée");
  // ---- 2. tickets (+1, +10, décompte) ----
  const tx=()=>a.d.querySelector('#sportExtras .tix-row[data-sp="nage"]');
  tx().querySelector('.tix-b[data-d="10"]').click();ok(a.st().config.sportsUser.nage.tickets===13,"tickets : +10");
  tx().querySelector('.tix-b[data-d="-1"]').click();ok(a.st().config.sportsUser.nage.tickets===12,"tickets : −1");
  // ---- 3. sorties libres ----
  a.d.querySelector('.out-b[data-sp="velo"]').click();a.d.getElementById("outMin").value="75";a.d.getElementById("outKm").value="28,5".replace(",",".");a.d.querySelector('.out-f[data-fl="3"]').click();a.d.querySelector(".out-save").click();
  let s1=a.st();ok(s1.outings&&s1.outings.length===1&&s1.outings[0].sp==="velo"&&s1.outings[0].min===75&&s1.outings[0].km===28.5&&s1.outings[0].fl===3,"sortie libre vélo enregistrée");
  ok(/Cette semaine/.test(a.d.getElementById("sportExtras").textContent)&&/28,5 km/.test(a.d.getElementById("sportExtras").textContent),"résumé de la semaine affiché");
  a.d.querySelector(".out-del").click();ok(a.st().outings.length===0,"suppression d'une sortie");
  // ---- 4. archivage triathlon (+ persistance) ----
  a.d.querySelector(".pane-arc").click();let s2=a.st();
  ok(!s2.config.objectivesCustom.some(o=>o.tri)&&s2.config.objectivesArchive.length===1&&s2.config.activities.tri.enabled===false&&!!s2.tri["1_nat"],"tri archivé, historique conservé");
  // ---- 5. compléments : import, ajout, suppression, rechargement ----
  openSet(a.d,"g_track","supps");
  const J=[{id:"whey",name:"Whey test",when:"seance",dose:"30 g",prot:28,kcal:115},{id:"mag",name:"Magnésium test",when:"soir",dose:"1 gélule"}];
  a.d.getElementById("spJson").value=JSON.stringify(J);a.d.getElementById("spImport").click();
  ok(a.st().config.suppsList.length===2,"compléments : import JSON");
  openSet(a.d,"g_track","supps");a.d.getElementById("spName").value="Créatine test";a.d.getElementById("spAdd").click();
  ok(a.st().config.suppsList.length===3,"compléments : ajout");
  openSet(a.d,"g_track","supps");a.d.querySelector('.sp-del[data-id="mag"]').click();
  ok(a.st().config.suppsList.length===2,"compléments : suppression");
  const LS=a.w.localStorage.getItem("suiviMuscu_v1");
  // ---- 6. rechargement : persistance + compléments dans le Journal ----
  let b=await boot(LS);tab(b.d,"v-day");await wait(100);
  ok(b.errs.length===0,"rechargement sans erreur");
  ok(b.w.SUPPS&&b.w.SUPPS.length===2&&b.w.SUPPS[0].id==="whey"&&b.w.SUPPS[0].prot===28,"SUPPS (global lu par le Journal) rechargé depuis l'état");
  ok(!/Pure Bio|Spiruline|Magnésium bisglycinate/.test(require("fs").readFileSync(R+"data.js","utf8")+require("fs").readFileSync(R+"app.js","utf8")),"aucun complément perso dans data.js / app.js");
  ok(b.d.querySelectorAll("#sportExtras").length===1,"bloc extras présent");
  // ---- 6b. Journal avec liste de compléments vide : pas d'erreur ----
  let z=await boot(seed());tab(z.d,"v-day");await wait(100);ok(z.errs.length===0&&z.w.SUPPS.length===0,"Journal avec 0 complément : aucune erreur, SUPPS vide");
  // ---- 7. échec de stockage -> alerte ----
  let c=await boot(seed());tab(c.d,"v-sport");c.w.Storage.prototype.setItem=function(){throw new Error("Quota");};
  c.d.querySelector('#sportExtras .tix-row .tix-b[data-d="1"]').click();await wait(320);
  const t=c.d.getElementById("fqToast");ok(t&&t.classList.contains("show")&&/Sauvegarde impossible/.test(t.textContent),"échec de stockage : alerte affichée");
  // ---- 8. regroupement des sauvegardes ----
  let e=await boot(seed());tab(e.d,"v-sport");const before=JSON.parse(e.w.localStorage.getItem("suiviMuscu_v1")).config.sportsUser.nage.tickets;
  e.d.querySelector('#sportExtras .tix-row[data-sp="nage"] .tix-b[data-d="1"]').click();
  const imm=JSON.parse(e.w.localStorage.getItem("suiviMuscu_v1")).config.sportsUser.nage.tickets;await wait(320);
  const aft=JSON.parse(e.w.localStorage.getItem("suiviMuscu_v1")).config.sportsUser.nage.tickets;
  ok(imm===before&&aft===before+1,"sauvegarde regroupée (écrite après ~200 ms)");
  // ---- 9. blocs clôturés, calendrier lundi/jeudi, « dernière fois », psoas, sorties libres (état réaliste) ----
  const r=JSON.parse(seed());r.config.blocksClosed=["b1","b2","b3","b4","b5"];Object.keys(r.sessions).forEach(k=>{if(k.startsWith("b6_"))delete r.sessions[k];}); /* B6 pas encore commencé */
  r.sessions["1_A"]={done:true,date:"2026-08-01",sets:{a1:[{kg:"10",r:"10"}],a2:[{kg:"0",r:"5"}]}}; /* B1 : couché + tractions */
  r.outings=[{id:"o1",iso:(()=>{const n=new Date();return n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0")+"-"+String(n.getDate()).padStart(2,"0");})(),sp:"course",min:50,km:9,fl:2}];
  let g=await boot(JSON.stringify(r));tab(g.d,"v-sport");
  const nx9=g.d.querySelector(".cell.next");ok(nx9&&nx9.getAttribute("data-b")==="b6"&&nx9.getAttribute("data-w")==="1"&&nx9.getAttribute("data-c")==="A","blocs B1–B5 clôturés : la prochaine séance est B6 S1 A");
  g.d.querySelector('.cell[data-b="b6"][data-w="1"][data-c="A"]').click();let det=g.d.getElementById("sessionDetail")?g.d.getElementById("sessionDetail").textContent:g.d.body.textContent;
  ok(/Étirement psoas/.test(det),"séance A : étirement psoas présent");
  {const phg=(k,f)=>{const el=g.d.querySelector('#sessionDetail .set[data-exo="'+k+'"][data-set="0"] .'+f);return el?el.placeholder:null;};
  ok(phg("a1","in-kg")==="10"&&phg("a1","in-r")==="10"&&phg("a2","in-kg")!=="0"&&phg("a2","in-r")!=="5","« dernière fois » : couché repris de B1 dans les cases, tractions NON reprises pour le militaire");}
  g.d.querySelector('.cell[data-b="b6"][data-w="1"][data-c="C"]').click();det=g.d.getElementById("sessionDetail")?g.d.getElementById("sessionDetail").textContent:g.d.body.textContent;
  ok(/Renfo psoas/.test(det),"séance C : renfo psoas présent");
  tab(g.d,"v-day");await wait(100);
  const days=[...g.d.querySelectorAll("[data-iso]")].filter(c=>c.querySelector&&c.querySelector(".cal-pills .p-muscu:not(.done)"));
  const wd=days.map(c=>new Date(c.getAttribute("data-iso")+"T12:00:00").getDay());
  ok(days.length>=4&&wd.every(x=>x===1||x===4),"calendrier : séances muscu à venir uniquement lundi/jeudi ("+days.length+" jours)");
  ok(!!g.d.querySelector(".cal-pills .p-out"),"sortie libre visible dans le calendrier");
  tab(g.d,"v-prog2");await wait(100);ok(/Sorties libres/.test((g.d.getElementById("outViz")||{}).textContent||""),"Progrès : volume hebdomadaire des sorties libres");
  // clôturer / rouvrir depuis l'app (état non clôturé : prochaine séance = reliquat de B1)
  const u=JSON.parse(seed());delete u.config.blocksClosed;u.sessions["1_B"]={};u.sessions["1_A"]={done:true,date:"2026-08-01",sets:{}};
  for(const b of ["b1","b2","b3","b4","b5"])for(const k of Object.keys(u.sessions))if(k===b||k.startsWith(b+"_"))u.sessions[k]=k.startsWith("b1")?{}:{};
  let h2=await boot(JSON.stringify(u));tab(h2.d,"v-sport");
  const nxt=h2.d.querySelector(".cell.next");const bb=nxt&&nxt.getAttribute("data-b");
  const cb=h2.d.querySelector(".blk-close");ok(!!cb&&bb==="b1","sans clôture : bloc B1 proposé, bouton « Clôturer » présent");
  if(cb){cb.click();await wait(50);const n2=h2.d.querySelector(".cell.next");ok(n2&&n2.getAttribute("data-b")!=="b1","après « Clôturer » : B1 n'est plus proposé");}
  // ---- 10. dialogues dans l'app + « Annuler » (plus de confirm/prompt/alert natifs) ----
  const SRCAPP=rd("app.js");
  ok(!SRCAPP.split("\n").some(l=>/(^|[^A-Za-z_.])(confirm|prompt|alert)\(/.test(l)&&!/function ui|typeof confirm/.test(l)),"aucun confirm/prompt/alert natif dans app.js");
  let k=await boot(seed());tab(k.d,"v-sport");
  // renommer l'objectif muscu via feuille de saisie
  k.d.getElementById("muscuTitle").querySelector(".pane-ren").click();
  const ov=k.d.querySelector(".ui-ov");ok(!!ov&&!!ov.querySelector(".ui-in"),"renommer : feuille de saisie affichée");
  ov.querySelector(".ui-in").value="Haut du corps";ov.querySelector(".ui-yes").click();
  ok(!k.d.querySelector(".ui-ov")&&k.st().config.objectivesCustom.some(o=>o.name==="Haut du corps"),"renommer : valider applique le nom et ferme la feuille");
  k.d.getElementById("muscuTitle").querySelector(".pane-ren").click();k.d.querySelector(".ui-no").click();
  ok(!k.d.querySelector(".ui-ov")&&k.st().config.objectivesCustom.some(o=>o.name==="Haut du corps"),"renommer : Annuler ferme sans rien changer");
  // sortie : suppression + Annuler
  k.d.querySelector('.out-b[data-sp="course"]').click();k.d.getElementById("outMin").value="40";k.d.querySelector(".out-save").click();
  k.d.querySelector(".out-del").click();ok(k.st().outings.length===0&&k.d.getElementById("undoBar").classList.contains("show"),"sortie supprimée : barre « Annuler » affichée");
  k.d.querySelector("#undoBar .undo-b").click();ok(k.st().outings.length===1,"Annuler : la sortie est restaurée");
  // archivage tri + Annuler (le tri est actif dans la graine)
  k.d.querySelector(".pane-arc").click();ok(!k.st().config.objectivesCustom.some(o=>o.tri),"archivage : appliqué sans confirmation bloquante");
  k.d.querySelector("#undoBar .undo-b").click();ok(k.st().config.objectivesCustom.some(o=>o.tri)&&k.st().config.activities.tri.enabled===true,"Annuler : le triathlon est de retour (objectif + activité)");
  // tout effacer : double confirmation
  k.d.getElementById("settingsBtn").click();k.d.querySelectorAll(".set-grptog").forEach(b=>b.click());k.d.querySelectorAll(".set-sectog").forEach(b=>b.click());
  const rs=k.d.getElementById("bkpReset");ok(!!rs,"bouton « Tout effacer » présent");
  if(rs){rs.click();ok(!!k.d.querySelector(".ui-ov"),"tout effacer : 1re confirmation");k.d.querySelector(".ui-yes").click();ok(!!k.d.querySelector(".ui-ov"),"tout effacer : 2e confirmation (dernière)");
    k.d.querySelector(".ui-yes").click();const z=k.st();ok(Object.keys(z.sessions).length===0&&Object.keys(z.days).length<=1&&(z.config.objectivesCustom||[]).length===0&&z.config.activities.muscu.enabled===false,"tout effacer : données effacées après les 2 confirmations (seul le jour affiché est recréé)");}
  // ---- 11. lisibilité + mode sombre ----
  const CSS=rd("style.css"),light=CSS.slice(0,CSS.indexOf("DARK:BEGIN"));
  const fs=[...light.matchAll(/font-size:\s*([\d.]+)px/g)].map(m=>parseFloat(m[1]));
  ok(Math.min(...fs)>=10&&fs.filter(x=>x<12).length<=45,"polices : minimum 10 px, <12 px limité aux éléments denses ("+fs.filter(x=>x<12).length+" règles)");
  ok(/@media \(prefers-color-scheme: dark\)/.test(CSS)&&/--primary-ink/.test(CSS)&&/prefers-reduced-motion/.test(CSS),"mode sombre automatique + réduction des animations présents");
  ok(/theme-color" content="#0e151b" media="\(prefers-color-scheme: dark\)"/.test(rd("index.html")),"barre d'état : theme-color sombre");
  // ---- 12. Progrès : blocs sans donnée récente masqués ----
  {const iso=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
   const base=JSON.parse(seed());base.days={};base.outings=[];
   let e=await boot(JSON.stringify(base));tab(e.d,"v-prog2");await wait(100);
   const txt=id=>(e.d.getElementById(id)||{}).textContent||"";
   ok(txt("weekViz").trim()===""&&txt("regularity").trim()===""&&txt("outViz").trim()==="","Progrès sans donnée : 7 derniers jours, Régularité et Sorties libres masqués");
   ok(e.d.getElementById("weightChart").parentNode.hidden&&e.d.getElementById("proteinChart").parentNode.hidden,"Progrès sans donnée : cartes Poids et Protéines masquées");
   const full=JSON.parse(seed());full.outings=[];
   full.days[iso(1)]={sleep:"7.5",water:6,sports:["Muscu"],weight:"70.0"};full.days[iso(3)]={weight:"70.4"};
   e=await boot(JSON.stringify(full));tab(e.d,"v-prog2");await wait(100);
   ok(/7 derniers jours/.test(txt("weekViz"))&&/Sommeil/.test(txt("weekViz"))&&/Eau/.test(txt("weekViz"))&&!/Protéines/.test(txt("weekViz")),"7 derniers jours : seules les courbes avec données sont affichées");
   ok(/Régularité/.test(txt("regularity")),"Régularité visible dès qu'une case est cochée");
   ok(!e.d.getElementById("weightChart").parentNode.hidden&&e.d.getElementById("weightChart").querySelector("svg"),"carte Poids visible avec 2 relevés");
   ok(e.errs.length===0,"Progrès : aucune erreur JS");}
  // ---- 13. Variante par défaut = dernière variante utilisée sur le même exercice ----
  {const vm=require("vm"),G={};G.window=G;vm.createContext(G);vm.runInContext(rd("data.js"),G);
   const ex7=G.PROGRAM_BLOCKS.b7.prog.A.exos.find(x=>x.name==="Développé couché barre"),ex6=G.PROGRAM_BLOCKS.b6.prog.A.exos.find(x=>x.name==="Développé couché barre"),id=ex7.id;
   ok(!!ex7&&!!ex6,"données de test : « Développé couché barre » présent en B6 et B7");
   const mk=o=>Object.assign({done:true,date:"2026-11-01",sets:{}},o);
   const base=()=>JSON.parse(seed());
   const open=async(e,b,w,c)=>{tab(e.d,"v-sport");e.d.querySelector('.cell[data-b="'+b+'"][data-w="'+w+'"][data-c="'+c+'"]').click();await wait(80);};
   const sel=e=>e.d.querySelector('#sessionDetail .exo-var[data-exo="'+id+'"]');
   const lbl=e=>sel(e).parentNode.querySelector("label").textContent;
   const inKg=(e,k)=>e.d.querySelector('#sessionDetail .set[data-exo="'+k+'"][data-set="0"] .in-kg');
   // A. même bloc : S1 en Haltères -> S2 présélectionne Haltères et l'explique
   let s=base();s.sessions.b7_1_A=mk({sets:{[id+"::Haltères"]:[{kg:"12",r:"10"}]},variant:{[id]:"Haltères"}});
   let e=await boot(JSON.stringify(s));await open(e,"b7",2,"A");
   ok(sel(e).value==="Haltères"&&/reprise de ta dernière séance/.test(lbl(e)),"variante présélectionnée depuis la séance précédente (+ explication)");
   ok(inKg(e,id+"::Haltères")!==null,"les séries s'affichent sous la variante reprise");
   // B. choix explicite d'une autre variante : respecté (plus de reprise automatique) ; « Version standard » n'existe plus
   ok(![...sel(e).options].some(o=>/standard/i.test(o.textContent)),"liste des variantes : plus de « Version standard »");
   sel(e).value="Machine";sel(e).dispatchEvent(new e.w.Event("change",{bubbles:true}));await wait(60);
   ok(sel(e).value==="Machine"&&!/reprise/.test(lbl(e))&&e.st().sessions.b7_2_A.variant[id]==="Machine","variante choisie à la main : conservée");
   // C. mémorisation à la 1re saisie (la variante ne bouge plus ensuite)
   e=await boot(JSON.stringify(s));await open(e,"b7",2,"A");
   const ik=inKg(e,id+"::Haltères");ik.value="15";ik.dispatchEvent(new e.w.Event("input",{bubbles:true}));
   ok(e.st().sessions.b7_2_A.variant[id]==="Haltères","1re saisie : variante mémorisée dans la séance");
   // D. séance déjà saisie sans variante : historique intact
   s=base();s.sessions.b7_1_A=mk({sets:{[id+"::Haltères"]:[{kg:"12",r:"10"}]},variant:{[id]:"Haltères"}});s.sessions.b7_2_A=mk({sets:{[id]:[{kg:"60",r:"8"}]}});
   e=await boot(JSON.stringify(s));await open(e,"b7",2,"A");
   ok(sel(e).value===""&&inKg(e,id)&&inKg(e,id).value==="60","séance existante sans variante : inchangée (pas de reprise)");
   // E. entre blocs : B6 en Machine -> B7 S1 présélectionne Machine
   s=base();s.sessions.b6_2_A=mk({variant:{[ex6.id]:"Machine"}});
   e=await boot(JSON.stringify(s));await open(e,"b7",1,"A");
   ok(sel(e).value==="Machine","entre blocs : la variante du bloc précédent est reprise");
   // F. aucune donnée antérieure : version standard, sans mention
   e=await boot(seed());await open(e,"b7",1,"A");
   ok(sel(e).value===""&&!/reprise/.test(lbl(e))&&e.errs.length===0,"sans historique : invite « Choisis ta variante », aucune erreur JS");}
  // ---- 14. Valeurs de la fois précédente (placeholders des cases kg/reps) ----
  {const vm=require("vm"),G={};G.window=G;vm.createContext(G);vm.runInContext(rd("data.js"),G);
   const id="a1",mk=o=>Object.assign({done:true,date:"2026-11-01",sets:{}},o),base=()=>JSON.parse(seed());
   const open=async(e,b,w,c)=>{tab(e.d,"v-sport");e.d.querySelector('.cell[data-b="'+b+'"][data-w="'+w+'"][data-c="'+c+'"]').click();await wait(80);};
   const ph=(e,k,f)=>{const el=e.d.querySelector('#sessionDetail .set[data-exo="'+k+'"][data-set="0"] .'+f);return el?el.placeholder:null;};
   // salle, même variante
   let s=base();s.sessions.b7_1_A=mk({sets:{[id]:[{kg:"60",r:"8"}]}});
   let e=await boot(JSON.stringify(s));await open(e,"b7",2,"A");
   ok(ph(e,id,"in-kg")==="60"&&ph(e,id,"in-r")==="8","cases : valeurs de la séance précédente (même exercice)");
   // variante reprise automatiquement -> ses valeurs
   s=base();s.sessions.b7_1_A=mk({sets:{[id+"::Haltères"]:[{kg:"24",r:"10"}]},variant:{[id]:"Haltères"}});
   e=await boot(JSON.stringify(s));await open(e,"b7",2,"A");
   ok(ph(e,id+"::Haltères","in-kg")==="24","cases : valeurs de la variante reprise automatiquement");
   // entre blocs
   s=base();s.sessions.b6_2_A=mk({sets:{[id]:[{kg:"70",r:"6"}]}});
   e=await boot(JSON.stringify(s));await open(e,"b7",1,"A");
   ok(ph(e,id,"in-kg")==="70","cases : valeurs reprises du bloc précédent");
   // maison : suivi à part -> 1re séance vide, puis valeurs de la séance maison précédente
   s=base();s.config.place="home";s.sessions.b7_1_A=mk({sets:{[id]:[{kg:"60",r:"8"}]}});
   e=await boot(JSON.stringify(s));await open(e,"b7",2,"A");
   ok(ph(e,id+"::Maison","in-kg")==="kg","maison : 1re séance, rien à reprendre (historique salle séparé)");
   s.sessions.b7_2_A=mk({sets:{[id+"::Maison"]:[{kg:"10",r:"12"}]}});
   e=await boot(JSON.stringify(s));await open(e,"b7",3,"A");
   ok(ph(e,id+"::Maison","in-kg")==="10"&&ph(e,id+"::Maison","in-r")==="12","maison : valeurs de la séance maison précédente");}
  // ---- 15. La valeur affichée dans les cases dépend de la variante choisie (la plus récente pour CETTE variante) ----
  {const id="a1",mk=o=>Object.assign({done:true,date:"2026-11-01",sets:{}},o);
   const s=JSON.parse(seed());
   s.sessions.b7_1_A=mk({sets:{[id+"::Haltères"]:[{kg:"24",r:"10"}]},variant:{[id]:"Haltères"}});
   s.sessions.b7_2_A=mk({sets:{[id+"::Machine"]:[{kg:"50",r:"8"}]},variant:{[id]:"Machine"}});
   const e=await boot(JSON.stringify(s));tab(e.d,"v-sport");e.d.querySelector('.cell[data-b="b7"][data-w="3"][data-c="A"]').click();await wait(80);
   const sel=()=>e.d.querySelector('#sessionDetail .exo-var[data-exo="'+id+'"]');
   const ph=k=>{const el=e.d.querySelector('#sessionDetail .set[data-exo="'+k+'"][data-set="0"] .in-kg');return el?el.placeholder:null;};
   const pick=async v=>{sel().value=v;sel().dispatchEvent(new e.w.Event("change",{bubbles:true}));await wait(60);};
   ok(sel().value==="Machine"&&ph(id+"::Machine")==="50","S3 : variante la plus récente (Machine) + sa dernière valeur");
   await pick("Haltères");ok(sel().value==="Haltères"&&ph(id+"::Haltères")==="24","changer pour Haltères : cases = dernière valeur Haltères");
   await pick("Machine");ok(ph(id+"::Machine")==="50","revenir à Machine : cases = dernière valeur Machine");
   await pick("Poulie");ok(sel().value==="Poulie"&&ph(id+"::Poulie")==="kg","variante jamais utilisée : cases vides (pas de valeur d'une autre variante)");
   ok(e.errs.length===0,"variantes : aucune erreur JS");}
  // ---- 16. Fiche exercice (Progrès) : historique détaillé par variante ; plus d'historique dans la séance ----
  {const id="a1",mk=o=>Object.assign({done:true,date:"2026-11-01",sets:{}},o);
   const s=JSON.parse(seed());
   s.sessions.b7_1_A=mk({sets:{[id+"::Haltères"]:[{kg:"24",r:"10"}]},variant:{[id]:"Haltères"}});
   s.sessions.b7_2_A=mk({sets:{[id+"::Machine"]:[{kg:"50",r:"8"}]},variant:{[id]:"Machine"}});
   const e=await boot(JSON.stringify(s));
   const T=()=>e.d.getElementById("exoSheet").textContent;
   tab(e.d,"v-prog2");await wait(80);
   const pick=e.d.getElementById("exoSheetPick");
   ok(!!pick&&[...pick.options].some(o=>o.textContent==="Développé couché barre"),"Progrès : fiche exercice listant les exercices saisis");
   ok(/Machine/.test(T())&&/63 kg/.test(T())&&/50×8/.test(T()),"fiche : variante la plus récente (Machine) sélectionnée, 1RM et dernière fois");
   [...e.d.querySelectorAll("#exoSheet .es-var")].find(b=>b.getAttribute("data-v")==="Haltères").click();await wait(40);
   ok(/32 kg/.test(T())&&/24×10/.test(T())&&!/63 kg/.test(T()),"fiche : chaque variante a son propre historique");
   tab(e.d,"v-sport");e.d.querySelector('.cell[data-b="b7"][data-w="3"][data-c="A"]').click();await wait(80);
   ok(!/📊 Historique/.test(e.d.getElementById("sessionDetail").textContent),"séance : le bloc « Historique » a quitté l'exercice");
   const e0=await boot(seed());tab(e0.d,"v-prog2");await wait(80);
   const emp=JSON.parse(seed());emp.sessions={};const e1=await boot(JSON.stringify(emp));tab(e1.d,"v-prog2");await wait(80);
   ok(e1.d.getElementById("exoSheet").textContent.trim()==="","fiche exercice masquée sans aucune saisie");
   ok(e.errs.length===0&&e0.errs.length===0&&e1.errs.length===0,"fiche exercice : aucune erreur JS");}
  // ---- 17. Séances abîmées : l'écran ne plante pas ----
  {const mk=o=>Object.assign({done:true,date:"2026-11-01",sets:{}},o);let n=0;
   const cases=[s=>{s.sessions.b7_1_A=null;s.sessions.b7_2_A={done:false,sets:null};s.sessions.b7_3_A={sets:{a1:null,a2:[null,{kg:null,r:undefined},{}],"a3::X":"abc"}};},
                s=>{s.sessions.b7_2_A=mk({sets:{a1:[{kg:"60",r:"8"}]},variant:"Haltères"});s.sessions.b7_3_A=mk({sets:{a1:[{kg:"60",r:"8"}]},variant:{a1:null}});},
                s=>{s.sessions.b7_1_A=mk({sets:{"a1::Maison":[{kg:"10",r:"12"}]},extra:[null,{id:"x1",name:"Test"}],variant:{a1:"Haltères"}});s.config.place="home";}];
   for(const fn of cases){const s=JSON.parse(seed());fn(s);
     for(const w of [1,2,3,4]){const e=await boot(JSON.stringify(s));tab(e.d,"v-sport");const cell=e.d.querySelector('.cell[data-b="b7"][data-w="'+w+'"][data-c="A"]');if(cell)cell.click();await wait(50);tab(e.d,"v-prog2");await wait(50);if(e.errs.length){n++;console.log("   erreur :",e.errs[0]);}}}
   ok(n===0,"séances abîmées (sets nul, variante invalide, extras nuls) : aucune erreur JS");}
  console.log(fails?("\n"+fails+" échec(s)"):"\nSMOKE OK");process.exit(fails?1:0);
})();
