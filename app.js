/* =========================================================
   Coach Muscu — app.js
   Toute la logique (stockage, rendu, interactions).
   Dépend de data.js (PROGRAM, PROGRAM2, PROGRAM_BLOCKS, BLOCK_ORDER,
   CODES, TRI, TRI_DISC, BRISTOL, SPORTS, PROG_OPTS, MUSCU_START, TRI_START).
   ========================================================= */
"use strict";
(function(){

  /* ---------------- Stockage local ---------------- */
  var KEY="suiviMuscu_v1";
  var STORAGE_OK=(function(){try{var k="__t_"+Date.now();localStorage.setItem(k,"1");localStorage.removeItem(k);return true;}catch(e){return false;}})();
  var memStore=null;
  function load(){if(!STORAGE_OK)return memStore;try{var r=localStorage.getItem(KEY);return r?JSON.parse(r):null;}catch(e){return null;}}
  function save(){try{var s=JSON.stringify(state);if(STORAGE_OK)localStorage.setItem(KEY,s);else memStore=state;}catch(e){}}

  var state=load()||{sessions:{},days:{},tri:{}};

  /* ============================================================
     STORE PARTAGÉ entre toutes les apps ricardospec.github.io
     (même origine = même localStorage). Clé dédiée, distincte de
     celle de chaque app, pour le calendrier commun :
       states   : { "YYYY-MM-DD": "cours|conge|repos|indispo" }  // voir DAY_TYPES (vocabulaire commun)
       events   : [ {id,start,end,label,type} ]
       deadlines: [ {id,date,label,icon} ]
     RÈGLE ANTI-CLOBBER : on relit TOUJOURS la version fraîche du
     disque avant d'écrire, et on ne modifie que l'entrée concernée
     (upsert par id). Aucune écriture n'écrase le store en bloc.
     ============================================================ */
  var PKEY="ricardospec_planning_v1";
  var pMem=null;
  function pLoad(){
    var o=null;
    if(STORAGE_OK){try{var r=localStorage.getItem(PKEY);o=r?JSON.parse(r):null;}catch(e){o=null;}}
    else o=pMem;
    if(!o||typeof o!=="object")o={};
    o.states=o.states||{};o.events=o.events||[];o.deadlines=o.deadlines||[];
    return o;
  }
  function pWrite(o){o.rev=Date.now();try{var s=JSON.stringify(o);if(STORAGE_OK)localStorage.setItem(PKEY,s);else pMem=o;}catch(e){}}
  function pMutate(fn){var o=pLoad();fn(o);pWrite(o);return o;}   // relit frais puis écrit

  function getDayState(iso){return pLoad().states[iso]||"";}
  function setDayState(iso,st){pMutate(function(o){if(st)o.states[iso]=st;else delete o.states[iso];});}
  function pDeadlines(){return pLoad().deadlines.slice().sort(function(a,b){return a.date<b.date?-1:1;});}
  function pEvents(){return pLoad().events;}
  function eventsOn(iso){return pEvents().filter(function(e){return iso>=e.start&&iso<=(e.end||e.start);});}

  /* Upsert idempotent des entrées statiques connues de CETTE app (deadlines/events),
     par id stable : présent une seule fois, ne duplique pas avec l'autre app. */
  function pEnsureSeed(){
    pMutate(function(o){
      o.removed=o.removed||{};
      (typeof DEADLINES!=="undefined"?DEADLINES:[]).forEach(function(d){
        var id=d.id||("dl:"+d.date+":"+d.label);
        if(o.removed[id])return;
        if(!o.deadlines.some(function(x){return x.id===id;}))o.deadlines.push({id:id,date:d.date,label:d.label,icon:d.icon||"🎯"});
      });
      (typeof EVENTS!=="undefined"?EVENTS:[]).forEach(function(e){
        var id=e.id||("ev:"+e.start+":"+e.label);
        if(o.removed[id])return;
        if(!o.events.some(function(x){return x.id===id;}))o.events.push({id:id,start:e.start,end:e.end||"",label:e.label,type:e.type||"perso"});
      });
    });
  }
  /* Édition des échéances (objectifs) — toujours via pMutate (anti-clobber). */
  function pAddDeadline(d){pMutate(function(o){o.deadlines.push({id:"u:"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),date:d.date,label:d.label,icon:d.icon||"🎯"});});}
  function pUpdateDeadline(id,patch){pMutate(function(o){o.deadlines.forEach(function(x){if(x.id===id){if(patch.date!==undefined)x.date=patch.date;if(patch.label!==undefined)x.label=patch.label;if(patch.icon!==undefined)x.icon=patch.icon;}});});}
  function pRemoveDeadline(id){pMutate(function(o){o.deadlines=o.deadlines.filter(function(x){return x.id!==id;});o.removed=o.removed||{};o.removed[id]=true;});}
  /* Migration unique : récupère les anciens états de jour stockés dans cette app
     (state.days[iso].status) vers le store partagé, sans écraser ce qui existe. */
  function pMigrateStates(){
    pMutate(function(o){Object.keys(state.days).forEach(function(iso){var st=state.days[iso].status;if(st&&!o.states[iso])o.states[iso]=st;});});
  }
  function pMigrateDayTypes(){if(typeof DAY_TYPE_MIGRATE==="undefined")return;pMutate(function(o){var s=o.states||{};Object.keys(s).forEach(function(iso){var nv=DAY_TYPE_MIGRATE[s[iso]];if(nv)s[iso]=nv;});});}
  function seedPlanOnce(){if(typeof PLAN_SEED==="undefined")return;pMutate(function(o){if(!o.seeds)o.seeds={};if(o.seeds.planGsheetJuil26)return;Object.keys(PLAN_SEED).forEach(function(iso){if(!o.states[iso])o.states[iso]=PLAN_SEED[iso];});o.seeds.planGsheetJuil26=true;});}
  if(!state.sessions)state.sessions={};
  if(!state.days)state.days={};
  if(!state.tri)state.tri={};

  /* ---------------- Dates ---------------- */
  var MOIS=["jan.","fév.","mars","avr.","mai","juin","juil.","août","sep.","oct.","nov.","déc."];
  var JOURS=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
  function isoOf(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
  function todayStr(){return isoOf(new Date());}
  function addDays(iso,n){var d=new Date(iso+"T00:00:00");d.setDate(d.getDate()+n);return d;}
  function ddmm(d){return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0");}
  function frDateFull(iso){var d=new Date(iso+"T00:00:00");var s=JOURS[d.getDay()]+" "+d.getDate()+" "+MOIS[d.getMonth()];return s.charAt(0).toUpperCase()+s.slice(1);}
  function cumWeeks(block){var n=0;for(var i=0;i<BLOCK_ORDER.length;i++){if(BLOCK_ORDER[i]===block)break;n+=PROGRAM_BLOCKS[BLOCK_ORDER[i]].weeks;}return n;}
  function muscuWeekDate(block,w){return ddmm(addDays(MUSCU_START,(cumWeeks(block)+w-1)*7));}
  function triWeekDate(w){return ddmm(addDays(TRI_START,(w-1)*7));}
  function num(v){return parseFloat((v===undefined||v===null?"":v).toString().replace(",","."));}
  function fr1(n){return n.toFixed(1).replace(".",",");}
  function nFmt(n){return (n%1===0)?(""+n):fr1(n);}
  function effPortion(it){if(!it||!it.nut)return "";var b=num(it.nut.base),q=num(it.qty);var n=(!isNaN(q)&&q>0)?q:b;if(isNaN(n)||n<=0)return "";var u=it.nut.baseUnit||it.unit||"g";return (u==="g"||u==="ml")?(nFmt(n)+" "+u):("×"+nFmt(n));}

  /* ---------------- Divers ---------------- */
  function slugify(s){return (""+s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");}
  function esc(s){return (""+(s==null?"":s)).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

  /* ---------------- Repas / aliments ---------------- */
  var MEALS=[{k:"pd",label:"Petit-déjeuner"},{k:"dj",label:"Déjeuner"},{k:"dn",label:"Dîner"},{k:"co",label:"Collation"}];
  var FOOD_UNITS=["g","ml","unité","portion","c. à s.","c. à c."];
  function unitOptions(sel){return FOOD_UNITS.map(function(u){return '<option value="'+u+'"'+(sel===u?' selected':'')+'>'+u+'</option>';}).join("");}
  /* ---------- Base d'aliments de référence (fichier base_aliments.json, enrichissable) ---------- */
  var FOOD_DB=[];
  function normFood(f,cat){if(!f||!f.name)return null;function s(v){return v==null?"":(""+v).trim();}var u=s(f.unit)||"g";
    return {name:s(f.name),unit:u,cat:cat,nut:{base:s(f.base),baseUnit:u,kcal:s(f.kcal),prot:s(f.prot),gluc:s(f.gluc),lip:s(f.lip),portion:s(f.portion)}};}
  function loadFoodDB(){
    try{
      if(typeof fetch!=="function")return;
      fetch("base_aliments.json",{cache:"no-store"}).then(function(r){return r&&r.ok?r.json():null;}).then(function(j){
        if(!j)return;var arr=[];["staples","suivi"].forEach(function(cat){(j[cat]||[]).forEach(function(f){var n=normFood(f,cat);if(n)arr.push(n);});});
        FOOD_DB=arr;
      }).catch(function(){});
    }catch(e){}
  }
  function foodFixMap(){if(!state.foodFix||typeof state.foodFix!=="object")state.foodFix={};return state.foodFix;}
  function countLoggedFood(k){var n=0;Object.keys(state.days).forEach(function(d){var mi=state.days[d].mealItems;if(!mi)return;MEALS.forEach(function(m){(mi[m.k]||[]).forEach(function(it){if(it&&it.name&&(""+it.name).trim().toLowerCase()===k)n++;});});});return n;}
  function migrateFood(k){var def=foodCatalog()[k];if(!def||!def.nut)return 0;var n=def.nut,c=0;Object.keys(state.days).forEach(function(d){var mi=state.days[d].mealItems;if(!mi)return;MEALS.forEach(function(m){(mi[m.k]||[]).forEach(function(it){if(it&&it.name&&(""+it.name).trim().toLowerCase()===k){it.unit=def.unit;it.nut={base:n.base,baseUnit:n.baseUnit,kcal:n.kcal,prot:n.prot,gluc:n.gluc,lip:n.lip,portion:n.portion};c++;}});});});return c;}
  function loggedFoods(){var seen={},out=[];Object.keys(state.days).sort().forEach(function(d){var mi=state.days[d].mealItems;if(!mi)return;MEALS.forEach(function(m){(mi[m.k]||[]).forEach(function(it){if(it&&it.name){var nm=(""+it.name).trim(),k=nm.toLowerCase();if(k&&!seen[k]){seen[k]=1;out.push(nm);}}});});});out.sort(function(a,b){return a.toLowerCase()<b.toLowerCase()?-1:1;});return out;}
  function foodCatalog(){var cat={};
    (FOOD_DB||[]).forEach(function(f){var k=(""+f.name).trim().toLowerCase();if(k)cat[k]={name:(""+f.name).trim(),unit:f.unit||"g",nut:f.nut||null,ref:true,cat:f.cat};});
    Object.keys(state.days).sort().forEach(function(d){var mi=state.days[d].mealItems;if(!mi)return;MEALS.forEach(function(m){(mi[m.k]||[]).forEach(function(it){if(it&&it.name&&(""+it.name).trim()){var k=(""+it.name).trim().toLowerCase();var ex=cat[k];if(!ex||!ex.ref)cat[k]={name:(""+it.name).trim(),unit:it.unit||"g",nut:it.nut||null};}});});});
    var fx=state.foodFix||{};Object.keys(fx).forEach(function(k){if(!cat[k])return;var f=fx[k]||{};var bn=cat[k].nut||{};function pick(v,dv){return (v!=null&&v!=="")?v:dv;}var u=pick(f.unit,bn.baseUnit||cat[k].unit||"g");
      cat[k]={name:cat[k].name,unit:u,nut:{base:pick(f.base,bn.base||"1"),baseUnit:u,kcal:pick(f.kcal,bn.kcal||""),prot:pick(f.prot,bn.prot||""),gluc:pick(f.gluc,bn.gluc||""),lip:pick(f.lip,bn.lip||""),portion:bn.portion||""},ref:cat[k].ref,cat:cat[k].cat,fixed:true};});
    return cat;}
  function foodNames(){var c=foodCatalog();return Object.keys(c).map(function(k){return c[k].name;}).sort(function(a,b){return a.toLowerCase()<b.toLowerCase()?-1:1;});}
  function scaleNut(it){if(!it||!it.nut)return null;var base=num(it.nut.base);var q=num(it.qty);var f;
    if(!isNaN(q)&&q>0&&!isNaN(base)&&base>0&&(it.unit||"")===(it.nut.baseUnit||""))f=q/base; /* quantité explicite compatible */
    else f=1; /* défaut : 1 portion (valeurs de base), unités ignorées */
    var r={};var kc=num(it.nut.kcal),pr=num(it.nut.prot);if(!isNaN(kc))r.kcal=kc*f;if(!isNaN(pr))r.prot=pr*f;if(r.kcal===undefined&&r.prot===undefined)return null;return r;}
  function dayTotals(d){var x=state.days[d];if(!x)return null;var k=0,p=0,any=false;if(x.mealItems)MEALS.forEach(function(m){(x.mealItems[m.k]||[]).forEach(function(it){var s=scaleNut(it);if(s){any=true;if(s.kcal)k+=s.kcal;if(s.prot)p+=s.prot;}});});if(x.supps&&typeof SUPPS!=="undefined")SUPPS.forEach(function(sp){if(x.supps[sp.id]){var mul=(x.supps2&&x.supps2[sp.id])?2:1;if(sp.prot){p+=sp.prot*mul;any=true;}if(sp.kcal){k+=sp.kcal*mul;any=true;}}});return any?{kcal:k,prot:p}:null;}

  /* ---------------- Objectifs ---------------- */
  var MUSCU_DEADLINE="2026-07-27";
  var RACE_DATE="2026-09-11";
  function blockDone(b){var n=0,wk=PROGRAM_BLOCKS[b].weeks;for(var w=1;w<=wk;w++)for(var i=0;i<CODES.length;i++)if(sess(b,w,CODES[i]).done)n++;return n;}
  function daysUntil(iso){return Math.round((new Date(iso+"T00:00:00")-new Date(todayStr()+"T00:00:00"))/86400000);}

  /* ---------------- Séances (multi-blocs) ---------------- */
  function sessKey(b,w,c){return b==="b1"?(w+"_"+c):(b+"_"+w+"_"+c);}
  function sess(b,w,c){var k=sessKey(b,w,c);if(!state.sessions[k])state.sessions[k]={done:false,sets:{}};return state.sessions[k];}
  /* ---------- Personnalisation durable des séances (override dans state.config) ---------- */
  function progCfg(){if(!state.config)state.config={};if(!state.config.program)state.config.program={};return state.config.program;}
  function progOf(b,c){return progCfg()[b+"_"+c]||PROGRAM_BLOCKS[b].prog[c];}
  function progIsCustom(b,c){return !!progCfg()[b+"_"+c];}
  function progOverride(b,c){var key=b+"_"+c,pc=progCfg();if(!pc[key])pc[key]=JSON.parse(JSON.stringify(PROGRAM_BLOCKS[b].prog[c]));return pc[key];}
  function progReset(b,c){delete progCfg()[b+"_"+c];save();}
  function nextSession(){for(var bi=0;bi<BLOCK_ORDER.length;bi++){var b=BLOCK_ORDER[bi];var wk=PROGRAM_BLOCKS[b].weeks;for(var w=1;w<=wk;w++){for(var i=0;i<CODES.length;i++){if(!sess(b,w,CODES[i]).done)return{block:b,w:w,c:CODES[i]};}}}return null;}
  function doneCount(){var n=0;BLOCK_ORDER.forEach(function(b){var wk=PROGRAM_BLOCKS[b].weeks;for(var w=1;w<=wk;w++)for(var i=0;i<CODES.length;i++)if(sess(b,w,CODES[i]).done)n++;});return n;}
  function totalSessions(){var n=0;BLOCK_ORDER.forEach(function(b){n+=PROGRAM_BLOCKS[b].weeks*CODES.length;});return n;}
  function triDoneCount(){var n=0;TRI.forEach(function(wk){TRI_DISC.forEach(function(p){var r=state.tri[wk.w+"_"+p[0]];if(r&&r.done)n++;});});return n;}

  /* Charges de la dernière séance identique (même code, semaine/bloc antérieurs) */
  function prevSets(b,w,c,exId){
    function pick(bl,wk){var ss=state.sessions[sessKey(bl,wk,c)];if(ss&&ss.sets&&ss.sets[exId]){var a=ss.sets[exId];for(var i=0;i<a.length;i++){if(a[i]&&(a[i].kg!==""||a[i].r!==""))return a;}}return null;}
    for(var ww=w-1;ww>=1;ww--){var r=pick(b,ww);if(r)return r;}
    var idx=BLOCK_ORDER.indexOf(b);
    for(var bi=idx-1;bi>=0;bi--){var bb=BLOCK_ORDER[bi];var wk=PROGRAM_BLOCKS[bb].weeks;for(var w2=wk;w2>=1;w2--){var r2=pick(bb,w2);if(r2)return r2;}}
    return null;
  }
  /* Progression des charges : meilleure série (kg max) par semaine, pour un exercice (code c + exId) du bloc b. */
  function exoTop(arr){var best=null;for(var i=0;i<arr.length;i++){var kg=num(arr[i]&&arr[i].kg);if(!isNaN(kg)&&kg>0&&(best===null||kg>best.kg))best={kg:kg,r:num(arr[i]&&arr[i].r)};}return best;}
  function exoSeries(b,c,exId){var wk=PROGRAM_BLOCKS[b].weeks,out=[];for(var w=1;w<=wk;w++){var ss=state.sessions[sessKey(b,w,c)];if(ss&&ss.sets&&ss.sets[exId]){var t=exoTop(ss.sets[exId]);if(t)out.push({w:w,kg:t.kg});}}return out;}
  function progHTML(b,c,exId){
    var arr=exoSeries(b,c,exId);if(!arr.length)return "";
    var max=0,min=Infinity;arr.forEach(function(p){if(p.kg>max)max=p.kg;if(p.kg<min)min=p.kg;});
    var spark="",trend="";
    if(arr.length>=2){
      var W=104,H=26,pad=3,n=arr.length,span=(max-min)||1;
      var pts=arr.map(function(p,i){var x=pad+i*((W-2*pad)/(n-1));var y=H-pad-((p.kg-min)/span)*(H-2*pad);return x.toFixed(1)+","+y.toFixed(1);});
      var lp=pts[pts.length-1].split(",");
      spark='<svg class="prog-spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none"><polyline points="'+pts.join(" ")+'"/><circle cx="'+lp[0]+'" cy="'+lp[1]+'" r="2.6"/></svg>';
      var d=arr[arr.length-1].kg-arr[0].kg;trend=d>0?'<span class="pg-up">+'+nFmt(d)+' kg</span>':(d<0?'<span class="pg-dn">'+nFmt(d)+' kg</span>':'<span class="pg-eq">stable</span>');
    }
    return '<div class="exo-prog"><span class="pg-rec">🏆 '+nFmt(max)+' kg</span>'+spark+trend+'</div>';
  }

  /* ---------------- Journée ---------------- */
  function day(d){
    if(!state.days[d])state.days[d]={program:"",sports:[],note:"",weight:"",meals:{pd:"",dj:"",dn:"",co:""},protein:false,meditation:false,sleep:"",stools:[],water:0};
    var x=state.days[d];
    if(!x.meals)x.meals={pd:"",dj:"",dn:"",co:""};
    if(!x.sports)x.sports=[];
    if(x.meditation===undefined)x.meditation=false;
    if(x.sleep===undefined)x.sleep="";
    if(!x.stools)x.stools=[];
    if(x.water===undefined)x.water=0;
    if(!x.supps)x.supps={};
    if(x.status===undefined)x.status="";
    if(!x.mealItems){x.mealItems={pd:[],dj:[],dn:[],co:[]};["pd","dj","dn","co"].forEach(function(kk){var t=(x.meals&&x.meals[kk])||"";if((""+t).trim())x.mealItems[kk].push({name:(""+t).trim(),qty:"",unit:"g",nut:null});});}
    else{["pd","dj","dn","co"].forEach(function(kk){if(!x.mealItems[kk])x.mealItems[kk]=[];});}
    return x;
  }

  /* ---------------- Minuteur de repos ---------------- */
  var restInt=null, restEnd=0;
  function restFor(t){if(/\bs\b/.test(t)||/s\/|s$/.test(t))return 30;if(/6-8|max/.test(t))return 120;if(/8-10/.test(t))return 90;if(/10-12/.test(t))return 75;return 60;}
  function fmtTime(s){var m=Math.floor(s/60);var ss=s%60;return m+":"+String(ss).padStart(2,"0");}
  function restTick(){var disp=document.getElementById("restDisp");if(!disp){clearInterval(restInt);restInt=null;return;}var rem=Math.max(0,Math.round((restEnd-Date.now())/1000));disp.textContent=fmtTime(rem);if(rem<=0){clearInterval(restInt);restInt=null;disp.classList.add("done");if(navigator.vibrate){try{navigator.vibrate([200,100,200]);}catch(e){}}}}
  function startRest(sec){restEnd=Date.now()+sec*1000;var disp=document.getElementById("restDisp");if(disp)disp.classList.remove("done");if(restInt)clearInterval(restInt);restTick();restInt=setInterval(restTick,250);}
  function stopRest(){if(restInt){clearInterval(restInt);restInt=null;}var disp=document.getElementById("restDisp");if(disp){disp.textContent="0:00";disp.classList.remove("done");}}

  /* ---------------- Bandeau contextuel (phase) ---------------- */
  function phaseTip(iso){
    if(iso<"2026-06-22")return {t:"Avant le Vercors 🧗",p:"Priorité escalade : monte le volume de grimpe pour arriver prêt. Garde 2 séances muscu max par semaine d'ici là."};
    if(iso<="2026-06-28")return {t:"Semaine Vercors 🧗",p:"Profite de la grimpe ! La muscu démarre à 4 séances au retour, le 27/06."};
    if(iso<="2026-07-31")return {t:"Bloc 1 — Construction",p:"Surcharge progressive : dès que tu boucles le haut de la fourchette de reps sur toutes les séries, ajoute du poids. Objectif 27 juillet. Le triathlon démarre le 6/7 en parallèle."};
    if(iso<="2026-08-28")return {t:"Bloc 2 — Plage ☀️",p:"Focus épaules / dos / bras : c'est ce qui ressort le plus. En parallèle le triathlon monte en charge — surveille la fatigue."};
    if(iso<="2026-09-13")return {t:"Affûtage triathlon 🏁",p:"On réduit le volume, on garde un peu d'intensité. Sommeil et récup prioritaires. Course les 11-13 septembre à Dinard !"};
    return {t:"Bravo 👏",p:"Gros été bouclé. Note tes ressentis et planifie la suite."};
  }

  /* ---------------- Navigation onglets ---------------- */
  var currentSel=null, currentTri=null, journalDate=todayStr();
  var homeCalOpen=false, heroOpen=false, nutriOpen=false, coursesOpen=false;  /* accueil : calendrier, prochaine séance, protéines & courses repliés par défaut */
  var blockOpen=null;  /* blocs de séance repliables (Sport) : bloc en cours ouvert par défaut */
  var bkpNudgeHidden=false;  /* rappel sauvegarde masqué pour la session */
  function activateTab(id){
    var t;
    document.querySelectorAll(".tab").forEach(function(x){x.classList.toggle("on",x.getAttribute("data-view")===id);});
    document.querySelectorAll(".view").forEach(function(v){v.classList.toggle("active",v.id===id);});
    if(id==="v-today"){renderToday();renderCalendars();}
    else if(id==="v-sport"){renderProgram();renderTri();renderSportTabs();}
    else if(id==="v-journal"){renderJournal();renderCalendars();}
    else if(id==="v-prog2")renderProgress();
    window.scrollTo(0,0);
    var sp0=document.getElementById("stickyProt");if(sp0&&id!=="v-today")sp0.classList.remove("show");
  }
  /* Sous-onglets de l'onglet Sport : construits à partir des activités actives (Réglages). */
  var sportSel="muscu";
  function sportActs(){var a=[];if(actEnabled("muscu"))a.push("muscu");if(actEnabled("tri"))a.push("tri");return a;}
  function renderSportTabs(){
    var host=document.getElementById("sportSub");if(!host)return;
    var pm=document.getElementById("sportMuscu"),pt=document.getElementById("sportTri");
    var acts=sportActs();
    if(!acts.length){host.innerHTML='<p class="hint" style="margin:0">Aucune activité active — active la muscu ou le triathlon dans les Réglages.</p>';if(pm)pm.hidden=true;if(pt)pt.hidden=true;return;}
    if(acts.indexOf(sportSel)<0)sportSel=acts[0];
    if(acts.length<2){host.innerHTML='<div class="sport-solo">'+esc((sportSel==="muscu"?"💪 ":"🏊 ")+actName(sportSel))+'</div>';}
    else{host.innerHTML=acts.map(function(k){return '<button class="subtab'+(k===sportSel?" on":"")+'" data-sport="'+k+'">'+esc((k==="muscu"?"💪 ":"🏊 ")+actName(k))+'</button>';}).join("");}
    if(pm)pm.hidden=(sportSel!=="muscu");if(pt)pt.hidden=(sportSel!=="tri");
    host.querySelectorAll("[data-sport]").forEach(function(b){b.onclick=function(){sportSel=b.getAttribute("data-sport");renderSportTabs();window.scrollTo(0,0);};});
  }
  function goSport(sel){sportSel=sel;activateTab("v-sport");}

  /* ---------------- En-tête ---------------- */
  function renderChip(){var n=nextSession();document.getElementById("wkChip").textContent=(n?(PROGRAM_BLOCKS[n.block].short+" · S"+n.w):"Fini")+" · "+doneCount()+"/"+totalSessions();}

  /* ---------------- Aujourd'hui ---------------- */
  /* Prochaine séance planifiée, TOUS sports actifs confondus (lue depuis le calendrier). */
  function nextScheduled(){
    rebuildSchedule();var cur=todayStr(),g=0;
    while(g<420){g++;var list=sessionsOn(cur);for(var i=0;i<list.length;i++){if(!list[i].done)return {iso:cur,s:list[i]};}cur=isoOf(addDays(cur,1));}
    return null;
  }
  /* Heures de révision d'un jour (même règle que l'app DSCG) — pour le repère 📚. */
  function studyHoursOf(iso){var st=getDayState(iso);if(st==="indispo")return 0;if(st==="conge")return 6;if(st==="cours")return 0.5;var wd=new Date(iso+"T00:00:00").getDay();return (wd===0||wd===6)?6:0.5;}
  /* Heures de révision RÉELLES saisies dans Mouche-Université (clé memoDSCG_v1 — LECTURE SEULE, jamais d'écriture). */
  function dscgDone(){
    try{
      var o=JSON.parse(localStorage.getItem("memoDSCG_v1")||"{}");var d=o&&o.done;
      if(!d||typeof d!=="object")return {};
      var out={};Object.keys(d).forEach(function(k){var v=d[k];if(/^\d{4}-\d{2}-\d{2}$/.test(k)&&typeof v==="number"&&isFinite(v)&&v>=0)out[k]=v;});
      return out;
    }catch(e){return {};}
  }
  function whenLabel(iso){var d=diffDays(iso,todayStr());if(d<=0)return "aujourd'hui";if(d===1)return "demain";return frDateShort(iso)+" · J-"+d;}

  function renderHero(){
    var hero=document.getElementById("heroCard");if(!hero)return;
    var next=nextScheduled();
    if(!next){hero.className="hero";hero.innerHTML='<div class="hero-body" style="padding-top:18px"><div class="lbl">Bravo</div><h2>Tout est bouclé 🎉</h2><div class="meta">Plus de séance planifiée pour l\'instant.</div></div>';return;}
    var s=next.s, muscu=(s.kind==="muscu");
    var icon=muscu?"🏋️":triIcon(s.disc);
    var when=whenLabel(next.iso);
    var tip=phaseTip(todayStr());
    var tipHTML='<div class="tip"><div class="t">'+tip.t+'</div><p>'+tip.p+'</p></div>';
    var body="";
    if(heroOpen){
      if(muscu){var blk=PROGRAM_BLOCKS[s.block],p=progOf(s.block,s.code);
        body='<div class="stitle">'+esc(blk.name)+' · Semaine '+s.w+' · '+esc(p.sub)+'</div>'+
             '<h2>'+esc(p.title.split("—")[0].trim())+' <span class="num">'+s.code+'</span></h2>'+
             '<div class="meta">'+p.exos.length+' exercices · '+when+'</div>'+
             '<div class="row2"><button class="btn accent" id="goSession">Ouvrir la séance</button><button class="btn ghost" id="quickDone">Marquer faite</button></div>'+tipHTML;
      }else{
        body='<div class="stitle">'+esc(actName("tri"))+' · Semaine '+s.w+'</div>'+
             '<h2>'+icon+' '+esc(triLabel(s.disc))+'</h2>'+
             '<div class="meta">'+when+'</div>'+
             '<div class="row2"><button class="btn accent" id="goSessionTri">Ouvrir la séance</button><button class="btn ghost" id="quickDoneTri">Marquer faite</button></div>'+tipHTML;
      }
    }
    hero.className="hero"+(heroOpen?" open":" folded");
    hero.innerHTML='<button class="hcol hero-toggle'+(heroOpen?" open":"")+'"><span class="hcol-ic">'+icon+'</span><span class="hcol-txt"><span class="hcol-k">Prochaine séance</span><span class="hcol-v">'+esc(s.label)+' · '+when+'</span></span><span class="hcol-chev">▾</span></button>'+(heroOpen?'<div class="hero-body">'+body+'</div>':'');
    hero.querySelector(".hero-toggle").onclick=function(){heroOpen=!heroOpen;renderHero();};
    if(heroOpen){
      if(muscu){
        var gs=hero.querySelector("#goSession");if(gs)gs.onclick=function(){currentSel={block:s.block,w:s.w,c:s.code};goSport("muscu");var sd=document.getElementById("sessionDetail");if(sd&&sd.scrollIntoView)sd.scrollIntoView({behavior:"smooth",block:"start"});};
        var qd=hero.querySelector("#quickDone");if(qd)qd.onclick=function(){var r=sess(s.block,s.w,s.code);r.done=true;if(!r.date)r.date=todayStr();save();renderChip();renderHero();renderCalendars();};
      }else{
        var gt=hero.querySelector("#goSessionTri");if(gt)gt.onclick=function(){currentTri={w:s.w,dz:s.disc};goSport("tri");var td=document.getElementById("triDetail");if(td&&td.scrollIntoView)td.scrollIntoView({behavior:"smooth",block:"start"});};
        var qt=hero.querySelector("#quickDoneTri");if(qt)qt.onclick=function(){var k=s.w+"_"+s.disc;var r=state.tri[k]||(state.tri[k]={});r.done=true;if(!r.date)r.date=todayStr();save();renderChip();renderHero();renderCalendars();};
      }
    }
  }

  function protAvg7(){var s=0,n=0;for(var i=0;i<7;i++){var d=isoOf(addDays(todayStr(),-i));var t=dayTotals(d);if(t){s+=t.prot;n++;}}return n?{avg:s/n,n:n}:null;}
  function nutriTip(tot){
    if(!tot)return 'Note tes repas pour suivre ta cible protéines — c\'est ton levier n°1 pour la forme plage.';
    if(tot.prot>=130)return '✓ Cible tenue. Les protéines sont ton point clé d\'ici la plage — garde ce rythme.';
    var r=Math.round(130-tot.prot);
    return 'Encore ~'+r+' g. Panier TGTG plutôt sucré/gras ? Complète avec un bloc protéiné (skyr, 2 œufs, whey) — bouton 🥡 ci-dessous.';
  }
  function wireTgtg(bt,pn,d,afterAdd){
    if(!bt||!pn)return;
    bt.addEventListener("click",function(){
      if(!pn.hidden){pn.hidden=true;return;}
      var tot=dayTotals(d),reste=Math.round(130-((tot&&tot.prot)||0));
      if(reste<=0){pn.innerHTML='<div class="tgtg-ok">✓ Cible protéines atteinte — rien à rattraper aujourd\'hui.</div>';pn.hidden=false;return;}
      var cat=foodCatalog(),opts=[];
      Object.keys(cat).forEach(function(k){var it=cat[k];if(!it.nut)return;var p=num(it.nut.prot);if(isNaN(p)||p<8)return;opts.push({name:it.name,unit:it.unit,nut:it.nut,p:p,st:it.cat==="staples"?1:0});});
      opts.sort(function(a,b){return (b.st-a.st)||(b.p-a.p);});opts=opts.slice(0,4);
      if(!opts.length){pn.innerHTML='<div class="tgtg-ok">Aucun aliment protéiné dans ta base — enrichis base_aliments.json.</div>';pn.hidden=false;return;}
      pn.innerHTML='<div class="tgtg-head">Il te reste ~'+reste+' g de protéines — ajoute en un tap :</div>'+
        opts.map(function(o,i){return '<button type="button" class="tgtg-opt" data-i="'+i+'"><span class="to-n">'+esc(o.name)+'</span><span class="to-p">+'+nFmt(o.p)+' g</span><span class="to-b">'+esc(o.nut.base)+' '+esc(o.nut.baseUnit||o.unit||"g")+'</span></button>';}).join("");
      pn.hidden=false;
      pn.querySelectorAll(".tgtg-opt").forEach(function(b){b.onclick=function(){var o=opts[+b.getAttribute("data-i")];
        var xx=day(d);if(!xx.mealItems)xx.mealItems={pd:[],dj:[],dn:[],co:[]};if(!xx.mealItems.co)xx.mealItems.co=[];
        xx.mealItems.co.push({name:o.name,qty:""+o.nut.base,unit:o.nut.baseUnit||o.unit||"g",nut:JSON.parse(JSON.stringify(o.nut))});
        save();if(afterAdd)afterAdd();};});
    });
  }
  function coursesList(){if(!Array.isArray(state.courses))state.courses=[];return state.courses;}
  function renderCourses(){
    var host=document.getElementById("todayCourses");if(!host)return;
    var list=coursesList();
    var total=list.reduce(function(s,it){var p=parseFloat(String(it.prix).replace(",","."));return s+((it.bought&&!isNaN(p))?p:0);},0);
    var boughtCount=list.filter(function(it){return it.bought;}).length;
    var vtxt=list.length?(boughtCount+"/"+list.length+" acheté"+(total>0?" · "+nFmt(total)+" €":"")):"liste vide";
    var head='<button type="button" class="hcol courses-toggle'+(coursesOpen?" open":"")+'"><span class="hcol-ic">🛒</span><span class="hcol-txt"><span class="hcol-k">Courses</span><span class="hcol-v">'+esc(vtxt)+'</span></span><span class="hcol-chev">▾</span></button>';
    var body="";
    if(coursesOpen){
      var cat=foodCatalog();var have={};list.forEach(function(it){have[(""+it.name).trim().toLowerCase()]=1;});
      var sug=[];Object.keys(cat).forEach(function(k){var c=cat[k];if(!c.nut||c.cat!=="staples"||have[k])return;var p=num(c.nut.prot);if(isNaN(p)||p<8)return;sug.push({name:c.name,p:p});});
      sug.sort(function(a,b){return b.p-a.p;});sug=sug.slice(0,6);
      var sugHTML=sug.length?'<div class="crs-sugtitle">Aliments protéinés à acheter :</div><div class="crs-sug">'+sug.map(function(o){return '<button type="button" class="crs-sugbtn" data-n="'+esc(o.name)+'">'+esc(o.name)+' <span>+'+nFmt(o.p)+'g</span></button>';}).join("")+'</div>':'';
      var addRow='<div class="crs-add"><input type="text" class="crs-name" placeholder="Article (ex. Skyr ×2)"><input type="text" inputmode="decimal" class="crs-prix" placeholder="€"><button type="button" class="btn accent crs-addbtn">Ajouter</button></div>';
      var rows=list.length?list.map(function(it,i){var p=parseFloat(String(it.prix).replace(",","."));return '<div class="crs-item'+(it.bought?" bought":"")+'" data-i="'+i+'"><button type="button" class="crs-check" data-i="'+i+'" aria-label="Acheté">'+(it.bought?"✓":"")+'</button><span class="crs-nm">'+esc(it.name)+'</span>'+(!isNaN(p)?'<span class="crs-prix-v">'+nFmt(p)+' €</span>':"")+'<button type="button" class="crs-del" data-i="'+i+'" aria-label="Supprimer">×</button></div>';}).join(""):'<div class="crs-empty">Rien pour l\'instant. Ajoute des articles à acheter, ou pioche dans les suggestions.</div>';
      var totalRow=total>0?'<div class="crs-total">Total acheté : <b>'+nFmt(total)+' €</b></div>':"";
      body='<div class="crs-body">'+addRow+sugHTML+'<div class="crs-list">'+rows+'</div>'+totalRow+'</div>';
    }
    host.innerHTML=head+body;
    host.querySelector(".courses-toggle").onclick=function(){coursesOpen=!coursesOpen;renderCourses();};
    if(coursesOpen){
      var nameEl=host.querySelector(".crs-name"),prixEl=host.querySelector(".crs-prix");
      function addItem(nm,prix){nm=(""+(nm||"")).trim();if(!nm)return;var l=coursesList();l.push({id:"c"+Date.now()+Math.floor(Math.random()*1000),name:nm,qty:"",prix:(""+(prix||"")).trim(),bought:false,ts:Date.now()});save();renderCourses();}
      var ab=host.querySelector(".crs-addbtn");if(ab)ab.onclick=function(){addItem(nameEl.value,prixEl.value);};
      if(nameEl)nameEl.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();addItem(nameEl.value,prixEl.value);}});
      host.querySelectorAll(".crs-sugbtn").forEach(function(b){b.onclick=function(){addItem(b.getAttribute("data-n"),"");};});
      host.querySelectorAll(".crs-check").forEach(function(b){b.onclick=function(){var i=+b.getAttribute("data-i");var l=coursesList();if(l[i]){l[i].bought=!l[i].bought;save();renderCourses();}};});
      host.querySelectorAll(".crs-del").forEach(function(b){b.onclick=function(){var i=+b.getAttribute("data-i");var l=coursesList();if(i>=0&&i<l.length){l.splice(i,1);save();renderCourses();}};});
    }
  }
  function renderTodayNutri(){
    var tot=dayTotals(todayStr());
    var nut=document.getElementById("todayNutri");
    if(nut){
      var reste=tot?Math.round(130-tot.prot):130;
      var vtxt=(tot?fr1(tot.prot):"0")+' g'+(tot?(tot.prot>=130?' · ✓ cible':' · encore '+reste+' g'):' · à noter');
      var head='<button type="button" class="hcol nutri-toggle'+(nutriOpen?' open':'')+'"><span class="hcol-ic">🥩</span><span class="hcol-txt"><span class="hcol-k">Protéines du jour</span><span class="hcol-v">'+vtxt+'</span></span><span class="hcol-chev">▾</span></button>';
      var body="";
      if(nutriOpen){
        var a7=protAvg7();
        var avgLine=a7?'<div class="nutri-avg">Moyenne 7 j : <b>'+fr1(a7.avg)+' g</b>/j'+(a7.avg>=130?' ✓':'')+'</div>':'';
        if(tot){
          var statTxt=tot.prot>=130?'<span class="ok">✓ cible atteinte</span>':'<span class="low">encore '+reste+' g pour la cible</span>';
          body='<div class="nutri-body"><div class="nutri-card"><div class="nutri-left"><span class="nutri-v">'+fr1(tot.prot)+'</span><span class="nutri-u">g protéines</span></div><div class="nutri-right"><div class="nutri-kcal">'+Math.round(tot.kcal)+' kcal</div><div class="nutri-goal">cible 130–150 g · '+statTxt+'</div></div></div>'+avgLine+'<div class="nutri-tip">'+nutriTip(tot)+'</div><button type="button" class="btn ghost nutri-tgtg">🥡 J\'ai mangé un TGTG — compléter</button><div class="tgtg-panel" hidden></div></div>';
        }else{
          body='<div class="nutri-body"><div class="nutri-card empty">Pas encore de repas noté aujourd\'hui — ajoute-les plus bas pour suivre tes protéines (cible 130–150 g).</div>'+avgLine+'<div class="nutri-tip">'+nutriTip(null)+'</div><button type="button" class="btn ghost nutri-tgtg">🥡 J\'ai mangé un TGTG — compléter</button><div class="tgtg-panel" hidden></div></div>';
        }
      }
      nut.innerHTML=head+body;
      nut.querySelector(".nutri-toggle").onclick=function(){nutriOpen=!nutriOpen;renderTodayNutri();};
      var tg=nut.querySelector(".nutri-tgtg"),tp=nut.querySelector(".tgtg-panel");if(tg&&tp)wireTgtg(tg,tp,todayStr(),function(){renderTodayNutri();buildDayForm(document.getElementById("todayLog"),todayStr());});
    }
    var sp=document.getElementById("stickyProt");
    if(sp){
      if(tot){var rst=Math.round(130-tot.prot);var st2=tot.prot>=130?'<span class="ok">✓ cible</span>':'<span class="low">encore '+rst+' g</span>';
        sp.innerHTML='<div class="sprot"><span class="sprot-v">'+fr1(tot.prot)+' g</span><span class="sprot-goal">protéines · cible 130–150 · '+st2+'</span></div>';
      }else sp.innerHTML='<div class="sprot"><span class="sprot-v">0 g</span><span class="sprot-goal">protéines aujourd\'hui</span></div>';
    }
  }
  function renderToday(){
    renderChip();
    renderHero();
    renderTodayNutri();
    renderCourses();
    buildDayForm(document.getElementById("todayLog"),todayStr());
    var bn=document.getElementById("backupNudge");
    if(bn){var st=backupStaleDays();var stale=(st===null||st>=10);
      if(stale&&!bkpNudgeHidden){bn.innerHTML='<div class="bkp-nudge"><span class="bkp-nudge-t">💾 '+(st===null?"Pense à sauvegarder tes données":("Sauvegarde : "+st+" jours sans export"))+'</span><button class="bkp-nudge-go" id="bkpNudgeGo">Exporter</button><button class="bkp-nudge-x" id="bkpNudgeX" aria-label="Masquer">×</button></div>';
        var g=document.getElementById("bkpNudgeGo");if(g)g.onclick=function(){menuBtnOpenSettings();};
        var xb=document.getElementById("bkpNudgeX");if(xb)xb.onclick=function(){bkpNudgeHidden=true;bn.innerHTML="";};
      }else bn.innerHTML="";
    }
  }
  function menuBtnOpenSettings(){openSettings();}

  /* ---------------- Muscu (grilles) ---------------- */
  function ensureBlockOpen(){
    if(blockOpen)return;
    blockOpen={};var n=nextSession();var cur=n?n.block:BLOCK_ORDER[0];
    BLOCK_ORDER.forEach(function(b){blockOpen[b]=(b===cur);});
  }
  function buildGrid(block){
    var blk=PROGRAM_BLOCKS[block];var n=nextSession();
    ensureBlockOpen();var open=!!blockOpen[block];
    var doneN=0,totN=blk.weeks*CODES.length,ww,ii;
    for(ww=1;ww<=blk.weeks;ww++)for(ii=0;ii<CODES.length;ii++)if(sess(block,ww,CODES[ii]).done)doneN++;
    var h='<div class="card pad blockcard'+(open?" open":"")+'">'+
      '<button type="button" class="blk-toggle" data-blk="'+block+'"><span class="blk-ttl">'+esc(blk.name)+'</span><span class="blk-meta">'+doneN+'/'+totN+'</span><span class="blk-chev">▾</span></button>'+
      '<div class="blk-body'+(open?"":" collapsed")+'">'+
      '<div class="legend"><span><i class="dot-next"></i>Prochaine</span><span><i class="dot-done"></i>Faite</span><span><i class="dot-todo"></i>À faire</span></div>'+
      '<table class="grid"><tr><th></th>';
    CODES.forEach(function(c){h+="<th>"+c+"</th>";});
    h+="</tr>";
    for(var w=1;w<=blk.weeks;w++){
      h+='<tr><td class="wk">S'+w+'<span class="wkd">'+muscuWeekDate(block,w)+'</span></td>';
      for(var i=0;i<CODES.length;i++){
        var c=CODES[i];var s=sess(block,w,c);var cls="cell";
        if(s.done)cls+=" done";
        if(n&&n.block===block&&n.w===w&&n.c===c)cls+=" next";
        if(currentSel&&currentSel.block===block&&currentSel.w===w&&currentSel.c===c)cls+=" sel";
        h+='<td><div class="'+cls+'" data-b="'+block+'" data-w="'+w+'" data-c="'+c+'">'+c+(s.done?'<span class="chk">✓</span>':'')+'</div></td>';
      }
      h+="</tr>";
    }
    h+="</table></div></div>";
    return h;
  }
  function renderProgram(){
    renderChip();
    var host=document.getElementById("progBlocks");
    host.innerHTML=BLOCK_ORDER.map(buildGrid).join("");
    host.querySelectorAll(".blk-toggle").forEach(function(b){b.onclick=function(){var k=b.getAttribute("data-blk");if(blockOpen)blockOpen[k]=!blockOpen[k];renderProgram();};});
    host.querySelectorAll(".cell").forEach(function(cell){
      cell.addEventListener("click",function(){
        currentSel={block:cell.getAttribute("data-b"),w:parseInt(cell.getAttribute("data-w"),10),c:cell.getAttribute("data-c")};
        renderProgram();renderSessionDetail();
        var sd=document.getElementById("sessionDetail");if(sd&&sd.scrollIntoView)sd.scrollIntoView({behavior:"smooth",block:"start"});
      });
    });
    if(currentSel)renderSessionDetail();else document.getElementById("sessionDetail").innerHTML="";
  }

  /* ---------------- Détail de séance ---------------- */
  function renderSessionDetail(){
    if(!currentSel)return;
    var b=currentSel.block,w=currentSel.w,c=currentSel.c;
    var p=progOf(b,c);var s=sess(b,w,c);
    var head=
      '<div class="eyebrow">Séance ouverte</div>'+
      '<div class="card pad">'+
      '<div class="sd-head"><div><div class="lbl">'+PROGRAM_BLOCKS[b].name+' · Semaine '+w+' · '+p.sub+'</div>'+
      '<h3>'+p.title.replace(/—.*/,"").trim()+' '+c+'</h3></div></div>'+
      '<div class="field" style="margin-top:12px"><button class="btn '+(s.done?'ghost':'accent')+'" id="toggleDone">'+(s.done?'✓ Séance faite — annuler':'Marquer la séance comme faite')+'</button></div>'+
      (s.done?'<div class="donedate"><label>Faite le <input type="date" id="doneDate" value="'+esc(s.date||todayStr())+'"></label></div>':'')+
      '<div class="rest"><div class="rest-disp" id="restDisp">0:00</div><div class="rest-btns">'+
        '<button data-sec="30">30 s</button><button data-sec="45">45 s</button><button data-sec="60">1:00</button><button data-sec="90">1:30</button><button data-sec="120">2:00</button><button class="stop" id="restStop">Stop</button>'+
      '</div></div>';
    var exosHTML="";
    p.exos.forEach(function(ex){
      if(!s.sets[ex.id])s.sets[ex.id]=[];
      var prev=prevSets(b,w,c,ex.id);
      var isSec=ex.unit==="sec";
      var perSide=/\/côté/.test(ex.target||"");
      var secLbl=perSide?"s/côté":"s";
      var secTgt=(String(ex.target).match(/(\d+)\s*s/)||[])[1]||"s";
      var rest=restFor(ex.target);
      var setsHTML="";
      for(var i=0;i<ex.sets;i++){
        var pr=(prev&&prev[i]&&prev[i].r!=="")?prev[i].r:(isSec?secTgt:"reps");
        if(isSec){
          setsHTML+='<div class="set sec" data-exo="'+ex.id+'" data-set="'+i+'">'+
            '<span class="sn">Série '+(i+1)+'</span>'+
            '<span class="setf"><input type="number" inputmode="numeric" class="in-r" placeholder="'+pr+'"><b>'+secLbl+'</b></span>'+
          '</div>';
        }else{
          var pk=(prev&&prev[i]&&prev[i].kg!=="")?prev[i].kg:"kg";
          setsHTML+='<div class="set" data-exo="'+ex.id+'" data-set="'+i+'">'+
            '<span class="sn">Série '+(i+1)+'</span>'+
            '<span class="setf"><input type="number" inputmode="decimal" step="0.5" class="in-kg" placeholder="'+pk+'"><b>kg</b></span>'+
            '<span class="setf"><input type="number" inputmode="numeric" class="in-r" placeholder="'+pr+'"><b>reps</b></span>'+
          '</div>';
        }
      }
      var lastTxt="";
      if(prev){
        if(isSec){lastTxt=prev.map(function(x){var v=(x&&x.r!=="")?x.r:"–";return v+" "+secLbl;}).join(" · ");}
        else{lastTxt=prev.map(function(x){var kg=(x&&x.kg!=="")?x.kg:"–";var r=(x&&x.r!=="")?x.r:"–";return kg+"×"+r;}).join(" · ");}
      }
      var _a=s.sets[ex.id]||[],filled=0;
      for(var fi=0;fi<ex.sets;fi++){var _it=_a[fi];if(_it&&(String(_it.kg).trim()!==""||String(_it.r).trim()!==""))filled++;}
      var stateChip=filled>=ex.sets?'<span class="exo-state done">✓</span>':(filled>0?'<span class="exo-state">'+filled+'/'+ex.sets+'</span>':'');
      exosHTML+=
        '<div class="exo" data-ex="'+ex.id+'">'+
          '<div class="exo-band" data-exo="'+ex.id+'" role="button" tabindex="0" aria-expanded="false">'+
            '<span class="nm">'+ex.name+'</span>'+
            '<span class="exo-band-r"><span class="tg">'+ex.target+'</span>'+stateChip+'<span class="exo-chev">▾</span></span>'+
          '</div>'+
          '<div class="exo-body collapsed" id="body-'+ex.id+'">'+
            '<div class="exo-tools"><button class="info-btn" data-help="'+ex.id+'" aria-label="Explication">i&nbsp;Explication</button></div>'+
            (lastTxt?'<div class="lastrep">Dernière fois : '+lastTxt+'</div>':'')+
            '<img class="exo-img" src="./images/'+slugify(ex.name)+'.jpg" alt="" onerror="this.style.display=\'none\'">'+
            '<div class="help" id="help-'+ex.id+'">'+ex.help+
              '<div class="exo-media"><a class="demo-link" href="https://www.youtube.com/results?search_query='+encodeURIComponent(ex.name+" musculation technique")+'" target="_blank" rel="noopener">▸ Voir une démo vidéo</a></div>'+
            '</div>'+
            '<div class="sets">'+setsHTML+'</div>'+
            progHTML(b,c,ex.id)+
            '<button class="rest-chip" data-sec="'+rest+'">⏱ Repos conseillé : '+rest+' s</button>'+
          '</div>'+
        '</div>';
    });
    if(!s.extra)s.extra=[];
    var extraHTML="";
    if(s.extra.length){
      extraHTML+='<div class="extra-sep">Exercices ajoutés</div>';
      s.extra.forEach(function(ex){
        if(!s.sets[ex.id])s.sets[ex.id]=[];
        var ns=ex.sets||3,sh="";
        for(var i=0;i<ns;i++){sh+='<div class="set" data-exo="'+ex.id+'" data-set="'+i+'"><span class="sn">Série '+(i+1)+'</span><span class="setf"><input type="number" inputmode="decimal" step="0.5" class="in-kg" placeholder="kg"><b>kg</b></span><span class="setf"><input type="number" inputmode="numeric" class="in-r" placeholder="reps"><b>reps</b></span></div>';}
        extraHTML+='<div class="exo exo-extra" data-ex="'+ex.id+'"><div class="exo-top"><input class="exo-name-in" data-xid="'+ex.id+'" value="'+esc(ex.name||"")+'" placeholder="Nom de l\'exercice (ex. Tractions)"><button class="exo-del" data-xid="'+ex.id+'" aria-label="Retirer">×</button></div><div class="sets">'+sh+'</div><button class="add-set" data-xid="'+ex.id+'">+ série</button></div>';
      });
    }
    var addBtnHTML='<button class="btn ghost add-extra" id="addExtraBtn">+ Ajouter un exercice</button>';
    var wrap=document.getElementById("sessionDetail");
    wrap.innerHTML=head+exosHTML+extraHTML+addBtnHTML+'</div>';

    wrap.querySelectorAll(".set").forEach(function(row){
      var exo=row.getAttribute("data-exo");var idx=parseInt(row.getAttribute("data-set"),10);
      var rec=(s.sets[exo]&&s.sets[exo][idx])||{kg:"",r:""};
      var kgEl=row.querySelector(".in-kg"),rEl=row.querySelector(".in-r");
      if(kgEl)kgEl.value=rec.kg||"";
      if(rEl)rEl.value=rec.r||"";
      function upd(){if(!s.sets[exo])s.sets[exo]=[];while(s.sets[exo].length<=idx)s.sets[exo].push({kg:"",r:""});s.sets[exo][idx]={kg:kgEl?kgEl.value:"",r:rEl?rEl.value:""};save();}
      if(kgEl)kgEl.addEventListener("input",upd);
      if(rEl)rEl.addEventListener("input",upd);
    });
    wrap.querySelectorAll(".info-btn").forEach(function(btn){btn.addEventListener("click",function(){document.getElementById("help-"+btn.getAttribute("data-help")).classList.toggle("open");});});
    function exoMeta(id){for(var q=0;q<p.exos.length;q++)if(p.exos[q].id===id)return p.exos[q];return null;}
    function refreshChip(id){var band=wrap.querySelector('.exo-band[data-exo="'+id+'"]');var m=exoMeta(id);if(!band||!m)return;var arr=s.sets[id]||[],f=0;for(var k=0;k<m.sets;k++){var it=arr[k];if(it&&(String(it.kg).trim()!==""||String(it.r).trim()!==""))f++;}var chip=band.querySelector(".exo-state");if(!f){if(chip)chip.parentNode.removeChild(chip);return;}if(!chip){chip=document.createElement("span");chip.className="exo-state";band.querySelector(".exo-band-r").insertBefore(chip,band.querySelector(".exo-chev"));}chip.textContent=f>=m.sets?"✓":f+"/"+m.sets;chip.classList.toggle("done",f>=m.sets);}
    wrap.querySelectorAll(".exo-band").forEach(function(band){
      function tog(){var id=band.getAttribute("data-exo");var body=document.getElementById("body-"+id);if(!body)return;var col=body.classList.toggle("collapsed");band.classList.toggle("open",!col);band.setAttribute("aria-expanded",col?"false":"true");refreshChip(id);}
      band.addEventListener("click",tog);
      band.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();tog();}});
    });
    wrap.querySelectorAll(".rest-chip").forEach(function(ch){ch.addEventListener("click",function(){startRest(parseInt(ch.getAttribute("data-sec"),10));});});
    wrap.querySelectorAll(".rest-btns button[data-sec]").forEach(function(bt){bt.addEventListener("click",function(){startRest(parseInt(bt.getAttribute("data-sec"),10));});});
    var rs=wrap.querySelector("#restStop");if(rs)rs.addEventListener("click",stopRest);
    wrap.querySelector("#toggleDone").addEventListener("click",function(){s.done=!s.done;if(s.done&&!s.date)s.date=todayStr();save();renderProgram();renderSessionDetail();});
    var mdd=wrap.querySelector("#doneDate");if(mdd)mdd.addEventListener("change",function(){if(this.value){s.date=this.value;save();renderProgram();}});
    var aeb=wrap.querySelector("#addExtraBtn");if(aeb)aeb.addEventListener("click",function(){s.extra.push({id:"x"+Date.now().toString(36),name:"",sets:3});save();renderSessionDetail();var ni=document.querySelector("#sessionDetail .exo-extra:last-of-type .exo-name-in");if(ni)ni.focus();});
    wrap.querySelectorAll(".exo-name-in").forEach(function(inp){inp.addEventListener("input",function(){var id=inp.getAttribute("data-xid");for(var j=0;j<s.extra.length;j++)if(s.extra[j].id===id){s.extra[j].name=inp.value;break;}save();});});
    wrap.querySelectorAll(".exo-del").forEach(function(bt){bt.addEventListener("click",function(){var id=bt.getAttribute("data-xid");s.extra=s.extra.filter(function(e){return e.id!==id;});delete s.sets[id];save();renderSessionDetail();});});
    wrap.querySelectorAll(".add-set").forEach(function(bt){bt.addEventListener("click",function(){var id=bt.getAttribute("data-xid");for(var j=0;j<s.extra.length;j++)if(s.extra[j].id===id){s.extra[j].sets=(s.extra[j].sets||3)+1;break;}save();renderSessionDetail();});});
  }

  /* ---------------- Triathlon ---------------- */
  function renderTri(){
    renderTriProgress();
    var meta=document.getElementById("triPlanMeta");
    if(meta){var dn=0;for(var i=1;i<=TRI.length;i++)TRI_DISC.forEach(function(p){var r=state.tri[i+"_"+p[0]];if(r&&r.done)dn++;});meta.textContent=dn+"/"+(TRI.length*TRI_DISC.length);}
    var t=document.getElementById("triTable");
    var h='<tr><th></th><th>Natation</th><th>Vélo</th><th>Course</th></tr>';
    TRI.forEach(function(wk){
      var tap=wk.nat.taper;
      h+='<tr><td class="wk">S'+wk.w+(tap?' *':'')+'<span class="wkd">'+triWeekDate(wk.w)+'</span></td>';
      TRI_DISC.forEach(function(pair){
        var dz=pair[0];var info=(dz==="nat"?wk.nat:dz==="velo"?wk.velo:wk.course);
        var rec=state.tri[wk.w+"_"+dz];var done=rec&&rec.done;
        var cls="tcell"+(done?" done":"");
        if(currentTri&&currentTri.w===wk.w&&currentTri.dz===dz)cls+=" sel";
        h+='<td><div class="'+cls+'" data-w="'+wk.w+'" data-z="'+dz+'">'+info.t+(done?'<span class="chk">✓</span>':'')+'</div></td>';
      });
      h+="</tr>";
    });
    t.innerHTML=h;
    t.querySelectorAll(".tcell").forEach(function(cell){
      cell.addEventListener("click",function(){
        currentTri={w:parseInt(cell.getAttribute("data-w"),10),dz:cell.getAttribute("data-z")};
        renderTri();renderTriDetail();
        var td=document.getElementById("triDetail");if(td&&td.scrollIntoView)td.scrollIntoView({behavior:"smooth",block:"start"});
      });
    });
    if(currentTri)renderTriDetail();else document.getElementById("triDetail").innerHTML="";
  }
  /* Allure calculée depuis distance+durée, selon la discipline. */
  function triPace(dz,dist,dur){
    if(isNaN(dist)||dist<=0||isNaN(dur)||dur<=0)return "";
    if(dz==="nat"){var p=dur/(dist/100);return "≈ "+fr1(p)+" min / 100 m";}
    if(dz==="velo"){return "≈ "+fr1(dist/(dur/60))+" km/h";}
    var m=Math.floor(dur/dist),s=Math.round((dur/dist-m)*60);return "≈ "+m+"'"+(s<10?"0":"")+s+" / km";
  }
  /* Meilleure distance loguée par discipline (toutes semaines). */
  function triBest(dz){var best=0;for(var i=1;i<=TRI.length;i++){var r=state.tri[i+"_"+dz];if(r&&num(r.dist)>best)best=num(r.dist);}return best;}
  function renderTriProgress(){
    var host=document.getElementById("triProgress");if(!host)return;
    if(!actEnabled("tri")){host.innerHTML="";return;}
    var rows=TRI_DISC.map(function(p){var dz=p[0],tg=TRI_TARGETS[dz],b=triBest(dz),pct=tg.v>0?Math.min(100,Math.round(b/tg.v*100)):0;
      return '<div class="tp-row"><span class="tp-ic">'+tg.icon+'</span><span class="tp-lbl">'+esc(p[1])+'</span><div class="tp-bar"><i style="width:'+pct+'%"></i></div><span class="tp-val">'+(b>0?nFmt(b)+" / ":"— / ")+tg.v+" "+tg.u+'</span></div>';
    }).join("");
    host.innerHTML='<div class="card pad tp-card"><div class="tp-head">Vers la distance olympique 🏁</div>'+rows+'<div class="tp-note">Meilleure distance loguée par discipline (renseigne distance + durée dans une séance).</div></div>';
  }
  function renderTriDetail(){
    if(!currentTri)return;
    var wk=TRI[currentTri.w-1];var dz=currentTri.dz;var names={nat:"Natation",velo:"Vélo",course:"Course à pied"};
    var info=(dz==="nat"?wk.nat:dz==="velo"?wk.velo:wk.course);
    var k=currentTri.w+"_"+dz;if(!state.tri[k])state.tri[k]={done:false,val:"",note:""};var rec=state.tri[k];
    var wrap=document.getElementById("triDetail");
    wrap.innerHTML=
      '<div class="eyebrow">Séance ouverte</div>'+
      '<div class="card pad">'+
        '<div class="sd-head"><div><div class="lbl">Semaine '+currentTri.w+(wk.nat.taper?' · affûtage':'')+'</div><h3>'+names[dz]+'</h3></div><span class="tg">'+info.t+'</span></div>'+
        '<p class="muted" style="margin-top:10px">'+info.d+'</p>'+
        (currentTri.w===10?'<div class="tip" style="margin-top:10px;background:#eef4f8;border:1px solid var(--line)"><div class="t" style="color:var(--primary)">🏁 Semaine de course</div><p style="color:var(--muted)">Triathlon Dinard Côte d\'Émeraude — 11-13 septembre. Affûtage, sommeil, et on profite !</p></div>':'')+
        '<div class="field" style="margin-top:12px"><button class="btn '+(rec.done?'ghost':'accent')+'" id="triDone">'+(rec.done?'✓ Faite — annuler':'Marquer comme faite')+'</button></div>'+
        (rec.done?'<div class="donedate"><label>Faite le <input type="date" id="triDoneDate" value="'+esc(rec.date||todayStr())+'"></label></div>':'')+
        '<div class="field"><label>Réalisé — distance ('+(TRI_TARGETS[dz].u)+') et durée (min)</label><div class="tri-io"><input type="number" inputmode="decimal" step="0.1" min="0" class="t-dist" placeholder="'+(dz==="nat"?"ex : 1300":"ex : "+(dz==="velo"?"32":"7,5"))+'"><span class="tri-u">'+TRI_TARGETS[dz].u+'</span><input type="number" inputmode="decimal" step="1" min="0" class="t-dur" placeholder="min"><span class="tri-u">min</span></div><div class="tri-pace" hidden></div>'+(rec.val?'<div class="tri-legacy">Ancien réalisé : '+esc(rec.val)+'</div>':'')+'</div>'+
        '<div class="field"><label>Ressenti / notes</label><textarea class="t-note" placeholder="sensations, allure, météo…"></textarea></div>'+
      '</div>';
    var di=wrap.querySelector(".t-dist"),du=wrap.querySelector(".t-dur"),pc=wrap.querySelector(".tri-pace");
    di.value=(rec.dist!=null&&rec.dist!=="")?rec.dist:"";du.value=(rec.dur!=null&&rec.dur!=="")?rec.dur:"";
    function showPace(){var t=triPace(dz,num(di.value),num(du.value));if(t){pc.textContent=t;pc.hidden=false;}else pc.hidden=true;}
    showPace();
    di.addEventListener("input",function(){rec.dist=this.value;save();showPace();renderTriProgress();});
    du.addEventListener("input",function(){rec.dur=this.value;save();showPace();renderTriProgress();});
    wrap.querySelector(".t-note").value=rec.note||"";
    wrap.querySelector(".t-note").addEventListener("input",function(){rec.note=this.value;save();});
    wrap.querySelector("#triDone").addEventListener("click",function(){rec.done=!rec.done;if(rec.done&&!rec.date)rec.date=todayStr();save();renderTri();renderTriDetail();});
    var tdd=wrap.querySelector("#triDoneDate");if(tdd)tdd.addEventListener("change",function(){if(this.value){rec.date=this.value;save();renderTri();}});
  }

  /* ---------------- Transit (Bristol) ---------------- */
  function bristolOptions(sel){var o='<option value="">— état —</option>';BRISTOL.forEach(function(b){o+='<option value="'+b.v+'"'+(sel===b.v?' selected':'')+'>'+b.label+'</option>';});return o;}
  function renderStools(host,d){
    if(!host)return;
    var arr=day(d).stools;var h="";
    h+='<div class="muted" style="margin:0 0 8px">'+(arr.length===0?"Aucun passage noté.":arr.length+" passage"+(arr.length>1?"s":"")+" aujourd'hui")+'</div>';
    arr.forEach(function(st,i){h+='<div class="stool-row" data-i="'+i+'"><select class="st-type">'+bristolOptions(st.type||"")+'</select><button class="st-del" data-i="'+i+'" aria-label="Supprimer">✕</button></div>';});
    h+='<button class="btn ghost st-add">+ Ajouter un passage</button>';
    host.innerHTML=h;
    host.querySelectorAll(".st-type").forEach(function(sel){sel.addEventListener("change",function(){var i=parseInt(sel.closest(".stool-row").getAttribute("data-i"),10);day(d).stools[i].type=sel.value;save();});});
    host.querySelectorAll(".st-del").forEach(function(b){b.addEventListener("click",function(){var i=parseInt(b.getAttribute("data-i"),10);day(d).stools.splice(i,1);save();renderStools(host,d);});});
    host.querySelector(".st-add").addEventListener("click",function(){day(d).stools.push({type:""});save();renderStools(host,d);});
    var wrap=host.closest&&host.closest(".supps-field");if(wrap){var m=wrap.querySelector(".tr-meta");if(m)m.textContent=arr.length?arr.length:"";}
  }

  /* ---------------- Formulaire de journée ---------------- */
  var suppsOpen=false, routinesOpen=false, transitOpen=false;  /* blocs Compléments / Routines / Transit repliés par défaut */
  function buildDayForm(container,d){
    var x=day(d);
    var dlId="foodlist-"+(container.id||"x");
    var chips='<div class="chips">'+SPORTS.map(function(sp){return '<button type="button" class="chip'+(x.sports.indexOf(sp)>-1?' on':'')+'" data-sport="'+sp+'">'+sp+'</button>';}).join("")+'</div>';
    var isJournal=container.id==="journalLog";
    container.innerHTML=
      '<div class="card pad">'+
        (isJournal?'<div class="meal-total-top"><div class="meal-total"></div></div>':'')+
        '<div class="field"><label>Sports du jour</label>'+chips+'</div>'+
        '<div class="field"><label>Poids (kg)</label><input type="number" inputmode="decimal" step="0.1" class="f-weight" placeholder="ex : 68,4"></div>'+
        '<div class="field"><label>Sommeil (h)</label><input type="number" inputmode="decimal" step="0.5" class="f-sleep" placeholder="ex : 7,5"></div>'+
        '<div class="field"><label>Hydratation — verres d\'eau</label><div class="water"><button type="button" class="wbtn wminus">−</button><span class="wcount">0</span><button type="button" class="wbtn wplus">+</button><span class="wml"></span></div></div>'+
        '<div class="field"><label>Repas</label>'+
          MEALS.map(function(m){return '<div class="meal"><div class="meal-h">'+m.label+'</div><div class="meal-items" data-mk="'+m.k+'"></div></div>';}).join("")+
          (isJournal?'':'<div class="meal-total"></div>')+
        '</div>'+
        '<div class="field supps-field">'+
          '<button type="button" class="supps-toggle'+(suppsOpen?' open':'')+'"><span class="supps-ttl">Compléments — ta routine</span><span class="supps-meta">'+((typeof SUPPS!=="undefined"?SUPPS:[]).filter(function(sp){return x.supps&&x.supps[sp.id];}).length)+'/'+(typeof SUPPS!=="undefined"?SUPPS.length:0)+'</span><span class="supps-chev">▾</span></button>'+
          '<div class="supps-body'+(suppsOpen?'':' collapsed')+'">'+
            (typeof SUPP_SLOTS!=="undefined"?SUPP_SLOTS:[]).map(function(slot){
              var items=(typeof SUPPS!=="undefined"?SUPPS:[]).filter(function(sp){return sp.when===slot.id;});
              if(!items.length)return "";
              return '<div class="supp-slot"><div class="supp-slot-h">'+esc(slot.label)+'</div>'+items.map(function(sp){return '<label class="supp"><input type="checkbox" class="f-supp" data-id="'+sp.id+'"><span class="supp-txt"><span class="supp-name">'+esc(sp.name)+'</span>'+(sp.dose?'<span class="supp-dose">'+esc(sp.dose)+'</span>':'')+'</span>'+(sp.prot?'<span class="supp-badge">+'+sp.prot+' g prot</span>':'')+'<button type="button" class="supp-x2'+((x.supps2&&x.supps2[sp.id])?" on":"")+'" data-x2="'+sp.id+'" title="Pris 2 fois aujourd\'hui">×2</button></label>';}).join("")+'</div>';
            }).join("")+
            '<div class="supp-hint">Le whey coché s\'ajoute à tes protéines du jour.</div>'+
            '<div class="xtras supps-x">'+((x.suppsX||[]).map(function(n,i){return '<span class="xchip">'+esc(n)+'<button type="button" class="xdel" data-k="supps" data-i="'+i+'">×</button></span>';}).join(""))+'</div>'+
            '<input class="x-in supps-xin" placeholder="Complément exceptionnel puis Entrée…">'+
          '</div>'+
        '</div>'+
        '<div class="field supps-field">'+
          '<button type="button" class="rx-toggle supps-toggle'+(routinesOpen?' open':'')+'"><span class="supps-ttl">Routines — ce qui te fait du bien</span><span class="supps-meta rx-meta"></span><span class="supps-chev">▾</span></button>'+
          '<div class="rx-body supps-body'+(routinesOpen?'':' collapsed')+'">'+
            (typeof ROUTINES!=="undefined"?ROUTINES:[]).map(function(r){var info=r.link?'<button type="button" class="rx-info" data-rx="'+r.id+'" aria-label="Infos">i</button>':'';var help=r.link?'<div class="rx-help" id="rxhelp-'+r.id+'"><a href="'+esc(r.link)+'" target="_blank" rel="noopener">'+esc(r.linkLabel||"Ouvrir")+' ↗</a></div>':'';return '<div class="rx-item"><label class="supp"><input type="checkbox" class="f-rx" data-id="'+r.id+'"><span class="supp-txt"><span class="supp-name">'+(r.icon?esc(r.icon)+' ':'')+esc(r.name)+'</span></span>'+info+'</label>'+help+'</div>';}).join("")+
            '<div class="xtras rx-x">'+((x.routinesX||[]).map(function(n,i){return '<span class="xchip">'+esc(n)+'<button type="button" class="xdel" data-k="rx" data-i="'+i+'">×</button></span>';}).join(""))+'</div>'+
            '<input class="x-in rx-xin" placeholder="Autre activité puis Entrée…">'+
            '<div class="supp-hint">Coche ce que tu as fait aujourd\'hui — la régularité compte plus que la quantité.</div>'+
          '</div>'+
        '</div>'+
        '<div class="field supps-field">'+
          '<button type="button" class="tr-toggle supps-toggle'+(transitOpen?' open':'')+'"><span class="supps-ttl">Transit — passages à la selle</span><span class="supps-meta tr-meta"></span><span class="supps-chev">▾</span></button>'+
          '<div class="tr-body supps-body'+(transitOpen?'':' collapsed')+'"><div class="stools f-stools"></div></div>'+
        '</div>'+
        '<div class="field"><label>Note du jour</label><textarea class="f-note" placeholder="ressenti, énergie, douleurs…"></textarea></div>'+
      '</div>';

    container.querySelector(".f-weight").value=x.weight||"";
    container.querySelector(".f-sleep").value=x.sleep||"";
    container.querySelector(".f-note").value=x.note||"";

    container.querySelector(".f-weight").addEventListener("input",function(){x.weight=this.value;save();});
    container.querySelector(".f-sleep").addEventListener("input",function(){x.sleep=this.value;save();});
    function updSuppsMeta(){var m=container.querySelector(".supps-meta:not(.rx-meta)");if(!m)return;var f=(typeof SUPPS!=="undefined"?SUPPS:[]).filter(function(sp){return x.supps&&x.supps[sp.id];}).length+(x.suppsX||[]).length;m.textContent=f+"/"+((typeof SUPPS!=="undefined"?SUPPS.length:0)+(x.suppsX||[]).length);}
    function updRxMeta(){var m=container.querySelector(".rx-meta");if(!m)return;var f=(typeof ROUTINES!=="undefined"?ROUTINES:[]).filter(function(r){return (x.routines&&x.routines[r.id])||(r.id==="medit"&&x.meditation);}).length+(x.routinesX||[]).length;m.textContent=f+"/"+((typeof ROUTINES!=="undefined"?ROUTINES.length:0)+(x.routinesX||[]).length);}
    updSuppsMeta();updRxMeta();
    container.querySelectorAll(".f-rx").forEach(function(cb){
      var id=cb.getAttribute("data-id");
      cb.checked=!!((x.routines&&x.routines[id])||(id==="medit"&&x.meditation));
      cb.addEventListener("change",function(){if(!x.routines)x.routines={};x.routines[id]=cb.checked;if(id==="medit")x.meditation=cb.checked;save();updRxMeta();});
    });
    (function(){var tg=container.querySelector(".rx-toggle");if(!tg)return;tg.addEventListener("click",function(){routinesOpen=!routinesOpen;tg.classList.toggle("open",routinesOpen);var body=container.querySelector(".rx-body");if(body)body.classList.toggle("collapsed",!routinesOpen);});})();
    container.querySelectorAll(".rx-info").forEach(function(bt){bt.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();var h=container.querySelector("#rxhelp-"+bt.getAttribute("data-rx"));if(h)h.classList.toggle("open");});});
    (function(){var tg=container.querySelector(".tr-toggle");if(!tg)return;var m=container.querySelector(".tr-meta");if(m)m.textContent=(x.stools&&x.stools.length)?x.stools.length:"";tg.addEventListener("click",function(){transitOpen=!transitOpen;tg.classList.toggle("open",transitOpen);var body=container.querySelector(".tr-body");if(body)body.classList.toggle("collapsed",!transitOpen);});})();
    (function(){var si=container.querySelector(".supps-xin");if(si)si.addEventListener("keydown",function(e){if(e.key==="Enter"){var v=(si.value||"").trim();if(!v)return;if(!x.suppsX)x.suppsX=[];x.suppsX.push(v);save();buildDayForm(container,d);}});
      var ri=container.querySelector(".rx-xin");if(ri)ri.addEventListener("keydown",function(e){if(e.key==="Enter"){var v=(ri.value||"").trim();if(!v)return;if(!x.routinesX)x.routinesX=[];x.routinesX.push(v);save();buildDayForm(container,d);}});
      container.querySelectorAll(".xdel").forEach(function(b){b.addEventListener("click",function(){var k=b.getAttribute("data-k"),i=+b.getAttribute("data-i");var arr=(k==="supps"?x.suppsX:x.routinesX)||[];arr.splice(i,1);save();buildDayForm(container,d);});});
    })();
    container.querySelector(".f-note").addEventListener("input",function(){x.note=this.value;save();});
    container.querySelectorAll(".f-supp").forEach(function(cb){
      var id=cb.getAttribute("data-id");
      cb.checked=!!(x.supps&&x.supps[id]);
      cb.addEventListener("change",function(){if(!x.supps)x.supps={};x.supps[id]=cb.checked;save();recalcTotals();
        updSuppsMeta();});
    });
    container.querySelectorAll(".supp-x2").forEach(function(bt){
      bt.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();var id=bt.getAttribute("data-x2");if(!x.supps2)x.supps2={};x.supps2[id]=!x.supps2[id];bt.classList.toggle("on",x.supps2[id]);save();if(x.supps&&x.supps[id])recalcTotals();});
    });
    (function(){var tg=container.querySelector(".supps-toggle");if(!tg)return;tg.addEventListener("click",function(){suppsOpen=!suppsOpen;tg.classList.toggle("open",suppsOpen);var body=container.querySelector(".supps-body");if(body)body.classList.toggle("collapsed",!suppsOpen);});})();
    container.querySelectorAll(".chip").forEach(function(ch){ch.addEventListener("click",function(){var sp=ch.getAttribute("data-sport");var arr=x.sports;var i=arr.indexOf(sp);if(i>-1){arr.splice(i,1);ch.classList.remove("on");}else{arr.push(sp);ch.classList.add("on");}save();});});

    (function(){
      var wc=container.querySelector(".wcount");var wml=container.querySelector(".wml");
      function upd(){wc.textContent=x.water;wml.textContent=x.water?("≈ "+fr1(x.water*0.25)+" L"):"1 verre ≈ 25 cl";}
      upd();
      container.querySelector(".wminus").addEventListener("click",function(){x.water=Math.max(0,x.water-1);save();upd();});
      container.querySelector(".wplus").addEventListener("click",function(){x.water=x.water+1;save();upd();});
    })();

    renderStools(container.querySelector(".f-stools"),d);

    function sumText(it){var s=scaleNut(it);if(!s)return "";return "≈ "+(s.kcal!==undefined?Math.round(s.kcal)+" kcal":"")+((s.kcal!==undefined&&s.prot!==undefined)?" · ":"")+(s.prot!==undefined?fr1(s.prot)+" g prot.":"");}
    function recalcTotals(){var t=dayTotals(d);var el=container.querySelector(".meal-total");if(el){if(t){el.textContent="Total du jour (estimé) : "+Math.round(t.kcal)+" kcal · "+fr1(t.prot)+" g protéines";el.className="meal-total on";}else{el.textContent="Tape un aliment puis Entrée. Touche une étiquette pour ses valeurs nutritionnelles.";el.className="meal-total";}}if(d===todayStr())renderTodayNutri();}
    var mealEdit={pd:-1,dj:-1,dn:-1,co:-1};
    function renderMeal(mk){
      var host=container.querySelector('.meal-items[data-mk="'+mk+'"]');
      var arr=day(d).mealItems[mk];var ed=mealEdit[mk];var h="";
      h+='<div class="tags">';
      arr.forEach(function(it,i){
        h+='<span class="tag'+(ed===i?" on":"")+(it.nut?" has-nut":"")+'" data-i="'+i+'">'+esc(it.name||"—")+(it.nut?'<span class="tag-q">'+esc(effPortion(it))+'</span>':'')+'<button type="button" class="tag-x" data-i="'+i+'" aria-label="Supprimer">×</button></span>';
      });
      h+='</div>';
      h+='<input type="text" class="tag-input" placeholder="Aliment puis Entrée…" enterkeyhint="done" autocomplete="off">';
      h+='<div class="tag-suggest" hidden></div>';
      if(ed>-1&&arr[ed]){
        var it=arr[ed];
        h+='<div class="tag-editor"><div class="te-title">'+esc(it.name)+'</div>'+
          '<div class="te-row"><label>Quantité<input type="number" inputmode="decimal" step="any" class="te-qty" placeholder="ex : 150" value="'+esc(it.qty)+'"></label>'+
          '<label>Unité<select class="te-unit">'+unitOptions(it.unit||"g")+'</select></label></div>'+
          '<div class="te-row"><label>Valeurs pour<input type="number" inputmode="decimal" step="any" class="te-base" placeholder="100" value="'+esc(it.nut?it.nut.base:"")+'"></label>'+
          '<label>&nbsp;<select class="te-baseunit">'+unitOptions(it.nut?it.nut.baseUnit:(it.unit||"g"))+'</select></label></div>'+
          '<div class="nut-grid">'+
            '<label>kcal<input type="number" inputmode="decimal" step="any" class="te-kcal" value="'+esc(it.nut?it.nut.kcal:"")+'"></label>'+
            '<label>Prot. (g)<input type="number" inputmode="decimal" step="any" class="te-prot" value="'+esc(it.nut?it.nut.prot:"")+'"></label>'+
            '<label>Gluc. (g)<input type="number" inputmode="decimal" step="any" class="te-gluc" value="'+esc(it.nut?it.nut.gluc:"")+'"></label>'+
            '<label>Lip. (g)<input type="number" inputmode="decimal" step="any" class="te-lip" value="'+esc(it.nut?it.nut.lip:"")+'"></label>'+
          '</div>'+
          (sumText(it)?'<div class="food-sum">'+sumText(it)+'</div>':'')+
          '<button type="button" class="te-close">Fermer</button>'+
        '</div>';
      }
      host.innerHTML=h;
      host.querySelectorAll(".tag").forEach(function(tg){
        tg.addEventListener("click",function(e){if(e.target.classList.contains("tag-x"))return;var i=parseInt(tg.getAttribute("data-i"),10);mealEdit[mk]=(mealEdit[mk]===i?-1:i);renderMeal(mk);});
      });
      host.querySelectorAll(".tag-x").forEach(function(b){
        b.addEventListener("click",function(e){e.stopPropagation();var i=parseInt(b.getAttribute("data-i"),10);day(d).mealItems[mk].splice(i,1);if(mealEdit[mk]===i)mealEdit[mk]=-1;else if(mealEdit[mk]>i)mealEdit[mk]--;save();renderMeal(mk);recalcTotals();});
      });
      var inp=host.querySelector(".tag-input");
      var sug=host.querySelector(".tag-suggest");
      function addFood(v){
        v=(""+v).trim();if(!v)return;
        var nit={name:v,qty:"",unit:"g",nut:null};var hit=foodCatalog()[v.toLowerCase()];
        if(hit&&hit.nut){nit.nut=JSON.parse(JSON.stringify(hit.nut));nit.unit=hit.unit||"g";var pq=num(nit.nut.portion)>0?nit.nut.portion:nit.nut.base;if(num(pq)>0)nit.qty=""+pq;}
        day(d).mealItems[mk].push(nit);save();renderMeal(mk);recalcTotals();
        var ni=host.querySelector(".tag-input");if(ni)ni.focus();
      }
      function showSug(){
        if(!sug)return;
        var v=inp.value.trim().toLowerCase();
        if(!v){sug.hidden=true;sug.innerHTML="";return;}
        var cat=foodCatalog(),starts=[],contains=[];
        Object.keys(cat).forEach(function(k){var idx=cat[k].name.toLowerCase().indexOf(v);if(idx===0)starts.push(k);else if(idx>0)contains.push(k);});
        var list=starts.concat(contains).slice(0,6);
        if(!list.length){sug.hidden=true;sug.innerHTML="";return;}
        sug.innerHTML=list.map(function(k){
          var f=cat[k],meta;
          if(f.nut&&f.nut.kcal!==""&&f.nut.kcal!=null&&!isNaN(num(f.nut.kcal))){
            meta='<span class="sug-meta">'+Math.round(num(f.nut.kcal))+' kcal'+(f.nut.prot!==""&&f.nut.prot!=null&&!isNaN(num(f.nut.prot))?' · '+fr1(num(f.nut.prot))+' g prot':'')+' / '+esc(f.nut.base||"100")+esc(f.nut.baseUnit||"g")+'</span>';
          }else{meta='<span class="sug-meta sug-empty">sans valeurs</span>';}
          return '<button type="button" class="sug" data-k="'+esc(k)+'">'+esc(f.name)+meta+'</button>';
        }).join("");
        sug.hidden=false;
        sug.querySelectorAll(".sug").forEach(function(b){
          b.addEventListener("mousedown",function(e){e.preventDefault();});
          b.addEventListener("click",function(){var f=foodCatalog()[b.getAttribute("data-k")];sug.hidden=true;addFood(f?f.name:b.getAttribute("data-k"));});
        });
      }
      inp.addEventListener("input",showSug);
      inp.addEventListener("focus",showSug);
      inp.addEventListener("blur",function(){setTimeout(function(){if(sug)sug.hidden=true;},180);});
      inp.addEventListener("keydown",function(e){
        if(e.key==="Enter"||e.keyCode===13){e.preventDefault();var v=this.value.trim();if(!v)return;if(sug)sug.hidden=true;addFood(v);}
      });
      if(ed>-1&&arr[ed]){
        var item=day(d).mealItems[mk][ed];
        var ensureNut=function(){if(!item.nut)item.nut={base:"",baseUnit:(item.unit||"g"),kcal:"",prot:"",gluc:"",lip:""};};
        var updEdSum=function(){var s=sumText(item);var el=host.querySelector(".food-sum");if(el){el.textContent=s;el.style.display=s?"":"none";}else if(s){var nd=document.createElement("div");nd.className="food-sum";nd.textContent=s;var box=host.querySelector(".tag-editor");box.insertBefore(nd,host.querySelector(".te-close"));}};
        host.querySelector(".te-qty").addEventListener("input",function(){item.qty=this.value;save();recalcTotals();updEdSum();});
        host.querySelector(".te-unit").addEventListener("change",function(){item.unit=this.value;save();recalcTotals();updEdSum();});
        host.querySelector(".te-base").addEventListener("input",function(){ensureNut();item.nut.base=this.value;save();recalcTotals();updEdSum();});
        host.querySelector(".te-baseunit").addEventListener("change",function(){ensureNut();item.nut.baseUnit=this.value;save();recalcTotals();updEdSum();});
        ["kcal","prot","gluc","lip"].forEach(function(f){host.querySelector(".te-"+f).addEventListener("input",function(){ensureNut();item.nut[f]=this.value;save();recalcTotals();updEdSum();});});
        host.querySelector(".te-close").addEventListener("click",function(){mealEdit[mk]=-1;renderMeal(mk);});
      }
    }
    MEALS.forEach(function(m){renderMeal(m.k);});
    recalcTotals();
  }

  /* ---------------- Journal ---------------- */
  function renderJournal(){
    document.getElementById("dayLabel").textContent=frDateFull(journalDate)+(journalDate===todayStr()?" · aujourd'hui":"");
    buildDayForm(document.getElementById("journalLog"),journalDate);
  }

  /* ---------------- Progrès : poids ---------------- */
  function weightEntries(){var arr=[];Object.keys(state.days).forEach(function(d){var wv=num(state.days[d].weight);if(!isNaN(wv))arr.push({d:d,w:wv});});arr.sort(function(a,b){return a.d<b.d?-1:1;});return arr;}
  function renderWeightChart(){
    var host=document.getElementById("weightChart");var e=weightEntries();
    if(e.length<2){host.innerHTML='<div class="empty">Note ton poids au moins 2 jours pour voir la courbe.</div>';return;}
    var W=320,H=92,pad=8;
    var vals=e.map(function(x){return x.w;});
    var min=Math.min.apply(null,vals),max=Math.max.apply(null,vals);
    if(max-min<1){max+=0.5;min-=0.5;}
    var n=e.length;
    function X(i){return pad+(i/(n-1))*(W-2*pad);}
    function Y(w){return pad+(1-(w-min)/(max-min))*(H-2*pad);}
    var pts=e.map(function(x,i){return X(i)+","+Y(x.w);}).join(" ");
    var dots=e.map(function(x,i){return '<circle cx="'+X(i).toFixed(1)+'" cy="'+Y(x.w).toFixed(1)+'" r="2.6" fill="#F4622B"/>';}).join("");
    var delta=e[n-1].w-e[0].w;
    host.innerHTML='<svg viewBox="0 0 '+W+' '+H+'"><polyline fill="none" stroke="#12466B" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="'+pts+'"/>'+dots+'</svg>'+
      '<div class="muted" style="margin-top:8px;font-size:13px">'+fr1(e[0].w)+' kg → '+fr1(e[n-1].w)+' kg · <b>'+(delta>=0?"+":"")+fr1(delta)+' kg</b> sur '+n+' relevés</div>';
  }

  /* ---------------- Progrès : protéines ---------------- */
  function proteinEntries(){var arr=[];Object.keys(state.days).forEach(function(d){var t=dayTotals(d);if(t&&t.prot>0)arr.push({d:d,p:t.prot});});arr.sort(function(a,b){return a.d<b.d?-1:1;});return arr;}
  function renderProteinChart(){
    var host=document.getElementById("proteinChart");if(!host)return;var e=proteinEntries();
    if(e.length<2){host.innerHTML='<div class="empty">Note tes repas au moins 2 jours pour voir la courbe des protéines.</div>';return;}
    var W=320,H=92,pad=8,TARGET=130;
    var vals=e.map(function(x){return x.p;});
    var min=Math.min.apply(null,vals),max=Math.max.apply(null,vals);
    min=Math.min(min,TARGET);max=Math.max(max,TARGET);
    if(max-min<10){max+=5;min-=5;}
    var n=e.length;
    function X(i){return pad+(i/(n-1))*(W-2*pad);}
    function Y(p){return pad+(1-(p-min)/(max-min))*(H-2*pad);}
    var pts=e.map(function(x,i){return X(i).toFixed(1)+","+Y(x.p).toFixed(1);}).join(" ");
    var dots=e.map(function(x,i){return '<circle cx="'+X(i).toFixed(1)+'" cy="'+Y(x.p).toFixed(1)+'" r="2.6" fill="'+(x.p>=TARGET?"#34a96a":"#F4622B")+'"/>';}).join("");
    var ty=Y(TARGET).toFixed(1);
    var tline='<line x1="'+pad+'" y1="'+ty+'" x2="'+(W-pad)+'" y2="'+ty+'" stroke="#34a96a" stroke-width="1" stroke-dasharray="4 3" opacity="0.75"/>';
    var avg=vals.reduce(function(s,v){return s+v;},0)/n,hits=vals.filter(function(v){return v>=TARGET;}).length;
    host.innerHTML='<svg viewBox="0 0 '+W+' '+H+'">'+tline+'<polyline fill="none" stroke="#12466B" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="'+pts+'"/>'+dots+'</svg>'+
      '<div class="muted" style="margin-top:8px;font-size:13px">Moyenne <b>'+Math.round(avg)+' g</b> · cible 130 g atteinte <b>'+hits+'/'+n+'</b> jours · <span style="color:#34a96a">– – cible</span></div>';
  }

  /* ---------------- Progrès : régularité (14 j) ---------------- */
  function renderActivityGraph(){
    var host=document.getElementById("activityGraph");
    var rows=[["Muscu","Muscu"],["Course","Course"],["Vélo","Vélo"],["Natation","Nat."],["Escalade","Escal."]];
    var today=todayStr();
    var days=[];for(var i=13;i>=0;i--){days.push(isoOf(addDays(today,-i)));}
    var h='<div class="act-dates">'+days.map(function(d,i){var dt=new Date(d+"T00:00:00");return '<div class="act-date">'+((i%2===0)?String(dt.getDate()):"")+'</div>';}).join("")+'</div>';
    rows.forEach(function(r){
      h+='<div class="act-row"><div class="act-label">'+r[1]+'</div><div class="act-cells">'+
        days.map(function(d){var sp=(state.days[d]&&state.days[d].sports)||[];var on=sp.indexOf(r[0])>-1;return '<div class="act-cell'+(on?' on':'')+(d===today?' today':'')+'"></div>';}).join("")+
      '</div></div>';
    });
    host.innerHTML=h;
  }

  /* ---------------- Progrès : bilan hebdo ---------------- */
  function buildWeeklySummary(){
    var today=todayStr();
    var wk=[];for(var i=6;i>=0;i--){wk.push(isoOf(addDays(today,-i)));}
    var sportCount={};SPORTS.forEach(function(s){sportCount[s]=0;});
    var sleeps=[],waters=[],stoolTotal=0,stoolDays=0,typeCount={},progOK=0,progDays=0,wFirst=null,wLast=null;
    wk.forEach(function(d){
      var x=state.days[d];if(!x)return;
      (x.sports||[]).forEach(function(s){if(sportCount[s]!==undefined)sportCount[s]++;});
      var sl=num(x.sleep);if(!isNaN(sl))sleeps.push(sl);
      if(typeof x.water==="number"&&x.water>0)waters.push(x.water);
      var arr=x.stools||[];if(arr.length){stoolDays++;stoolTotal+=arr.length;arr.forEach(function(st){if(st.type)typeCount[st.type]=(typeCount[st.type]||0)+1;});}
      if(x.program){progDays++;if(x.program==="Oui")progOK++;}
      var wv=num(x.weight);if(!isNaN(wv)){if(wFirst===null)wFirst=wv;wLast=wv;}
    });
    function avg(a){if(!a.length)return null;var s=0;a.forEach(function(v){s+=v;});return s/a.length;}
    var domType="",domN=0;Object.keys(typeCount).forEach(function(t){if(typeCount[t]>domN){domN=typeCount[t];domType=t;}});
    var aw=avg(waters),asl=avg(sleeps);
    var L=[];
    L.push("BILAN SEMAINE — "+ddmm(new Date(wk[0]+"T00:00:00"))+" au "+ddmm(new Date(wk[6]+"T00:00:00")));
    L.push("");
    L.push("Muscu : "+sportCount["Muscu"]+" séance(s) cette semaine · "+doneCount()+"/"+totalSessions()+" au total");
    L.push("Triathlon : nat "+sportCount["Natation"]+" · vélo "+sportCount["Vélo"]+" · course "+sportCount["Course"]+" · "+triDoneCount()+"/30 au total");
    if(sportCount["Escalade"])L.push("Escalade : "+sportCount["Escalade"]+" séance(s)");
    L.push(wFirst!==null?("Poids : "+fr1(wLast)+" kg ("+((wLast-wFirst)>=0?"+":"")+fr1(wLast-wFirst)+" kg sur la semaine)"):"Poids : non renseigné");
    L.push("Sommeil moyen : "+(asl?fr1(asl)+" h":"—"));
    L.push("Hydratation : "+(aw?fr1(aw)+" verres/j (~"+fr1(aw*0.25)+" L)":"—"));
    L.push("Transit : "+(stoolDays?(fr1(stoolTotal/stoolDays)+" passage(s)/j"+(domType?", souvent type "+domType:"")):"—"));
    var protArr=[];wk.forEach(function(d){var t=dayTotals(d);if(t&&t.prot>0)protArr.push(t.prot);});
    var apk=avg(protArr);
    L.push("Protéines (estimé) : "+(apk?(Math.round(apk)+" g/j en moyenne"):"— (à renseigner via les repas)"));
    L.push("");
    L.push("Ressenti de la semaine : (à compléter)");
    L.push("📸 J'ajoute une photo ici si je veux une analyse de progression.");
    return L.join("\n");
  }

  /* ---------------- Progrès : rendu ---------------- */
  function renderGoals(){
    var v=document.getElementById("v-prog2");
    var host=document.getElementById("goalsHost");
    if(!host){host=document.createElement("div");host.id="goalsHost";var h2=v.querySelector("h2.page");v.insertBefore(host,h2.nextSibling);}
    function dtxt(n){return n>0?("J-"+n):(n===0?"Jour J !":"passé");}
    function goal(title,sub,done,total,dleft,go){
      var pct=total?Math.round(done/total*100):0;var remain=Math.max(0,total-done);
      return '<div class="goal goal-click" data-goto="'+go+'">'+
        '<div class="goal-head"><div class="goal-name">'+title+'</div><span class="goal-badge">'+dtxt(dleft)+' ›</span></div>'+
        '<div class="goal-sub">'+sub+'</div>'+
        '<div class="bar"><div class="bar-fill" style="width:'+Math.max(0,Math.min(100,pct))+'%"></div></div>'+
        '<div class="goal-meta"><b>'+pct+'%</b> · '+done+'/'+total+' séances · '+remain+' restante'+(remain>1?"s":"")+'</div>'+
      '</div>';
    }
    host.innerHTML='<div class="card pad"><div class="sec-title">Objectifs</div>'+
      goal("💪 Muscu — Bloc 1","obj. 27 juil.",blockDone("b1"),PROGRAM_BLOCKS.b1.weeks*CODES.length,daysUntil(MUSCU_DEADLINE),"muscu")+
      goal("🏊 Triathlon — Dinard","course 11-13 sept.",triDoneCount(),30,daysUntil(RACE_DATE),"tri")+
    '</div>';
    host.querySelectorAll("[data-goto]").forEach(function(el){el.onclick=function(){var g=el.getAttribute("data-goto");if(g)goSport(g);};});
  }

  function weekVizHTML(){
    var days=[];for(var i=6;i>=0;i--)days.push(isoOf(addDays(todayStr(),-i)));
    var DL=["D","L","M","M","J","V","S"];
    function chart(title,icon,vals,target,unit){
      var max=target;vals.forEach(function(v){if(v.v!=null&&v.v>max)max=v.v;});
      var bars=vals.map(function(v){var h=v.v==null?4:Math.max(6,Math.round(v.v/max*46));var cls=v.v==null?" nv":(v.v>=target?" ok":"");return '<div class="wv-col"><i class="wv-bar'+cls+'" style="height:'+h+'px"></i><span class="wv-d">'+v.d+'</span></div>';}).join("");
      return '<div class="wv-block"><div class="wv-t">'+icon+' '+title+' <span class="wv-target">cible '+target+' '+unit+'</span></div><div class="wv-bars">'+bars+'</div></div>';
    }
    var prot=[],eau=[],som=[];
    days.forEach(function(d){var lab=DL[new Date(d+"T00:00:00").getDay()];var x=state.days[d];
      var t=dayTotals(d);prot.push({d:lab,v:t?Math.round(t.prot):null});
      eau.push({d:lab,v:(x&&x.water)?x.water:null});
      var sl=x?num(x.sleep):NaN;som.push({d:lab,v:isNaN(sl)?null:sl});
    });
    return '<div class="card pad"><div class="sec-title">7 derniers jours</div>'+
      chart("Protéines","🥩",prot,130,"g")+chart("Eau","💧",eau,8,"verres")+chart("Sommeil","😴",som,8,"h")+
      '<div class="wv-note">Barre pleine couleur = cible atteinte · gris clair = pas de donnée.</div></div>';
  }
  function renderProgress(){
    renderGoals();
    var wv=document.getElementById("weekViz");if(wv)wv.innerHTML=weekVizHTML();
    var dc=doneCount();
    var sleeps=[],meditDays=0,sportTally={},progFollow=0,progTot=0,stoolDays=0,stoolTotal=0,typeCount={},waters=[];
    Object.keys(state.days).forEach(function(d){
      var x=state.days[d];
      var sl=num(x.sleep);if(!isNaN(sl))sleeps.push(sl);
      if(x.meditation)meditDays++;
      (x.sports||[]).forEach(function(s){sportTally[s]=(sportTally[s]||0)+1;});
      if(x.program){progTot++;if(x.program==="Oui")progFollow++;}
      var arr=x.stools||[];if(arr.length){stoolDays++;stoolTotal+=arr.length;arr.forEach(function(st){if(st.type)typeCount[st.type]=(typeCount[st.type]||0)+1;});}
      if(typeof x.water==="number"&&x.water>0)waters.push(x.water);
    });
    function avg(a){if(!a.length)return null;var s=0;a.forEach(function(v){s+=v;});return s/a.length;}
    var avgSleep=avg(sleeps),waterAvg=avg(waters),stoolAvg=stoolDays?(stoolTotal/stoolDays):null;
    var domType="",domN=0;Object.keys(typeCount).forEach(function(t){if(typeCount[t]>domN){domN=typeCount[t];domType=t;}});
    var topSports=Object.keys(sportTally).sort(function(a,b){return sportTally[b]-sportTally[a];}).slice(0,3).map(function(k){return k+" ("+sportTally[k]+")";}).join(", ")||"—";

    var protList=[];Object.keys(state.days).forEach(function(d){var t=dayTotals(d);if(t&&t.prot>0)protList.push(t.prot);});
    var protAvg=avg(protList);
    var protStatus=protAvg==null?"":(protAvg>=130?" · ✓":" · ↓ "+Math.round(130-protAvg)+" g");
    var we=weightEntries();var kgWeek=null;
    if(we.length>=2){var spanDays=(new Date(we[we.length-1].d+"T00:00:00")-new Date(we[0].d+"T00:00:00"))/86400000;if(spanDays>=1)kgWeek=(we[we.length-1].w-we[0].w)/(spanDays/7);}
    var wStatus=kgWeek==null?"":(kgWeek<0.2?" · sous la cible":(kgWeek>0.3?" · au-dessus":" · ✓"));

    document.getElementById("statGrid").innerHTML=
      '<div class="stat"><div class="v">'+dc+'<span style="font-size:15px;color:var(--muted)">/'+totalSessions()+'</span></div><div class="k">Séances muscu faites</div></div>'+
      '<div class="stat"><div class="v">'+triDoneCount()+'<span style="font-size:15px;color:var(--muted)">/30</span></div><div class="k">Séances triathlon faites</div></div>'+
      '<div class="stat"><div class="v">'+(protAvg!=null?Math.round(protAvg):'—')+(protAvg!=null?'<span style="font-size:15px;color:var(--muted)"> g</span>':'')+'</div><div class="k">Protéines / j · cible 130-150'+protStatus+'</div></div>'+
      '<div class="stat"><div class="v">'+(kgWeek!=null?((kgWeek>=0?'+':'')+fr1(kgWeek)):'—')+(kgWeek!=null?'<span style="font-size:15px;color:var(--muted)"> kg/sem</span>':'')+'</div><div class="k">Prise de poids · cible +0,2-0,3'+wStatus+'</div></div>'+
      '<div class="stat"><div class="v">'+(avgSleep?fr1(avgSleep):'—')+'<span style="font-size:15px;color:var(--muted)"> h</span></div><div class="k">Sommeil moyen / nuit</div></div>'+
      '<div class="stat"><div class="v">'+(waterAvg?fr1(waterAvg):'—')+'</div><div class="k">Eau / jour (verres)</div></div>'+
      '<div class="stat"><div class="v">'+meditDays+'</div><div class="k">Jours de méditation</div></div>'+
      '<div class="stat"><div class="v" style="font-size:15px;line-height:1.3;padding-top:4px">'+topSports+'</div><div class="k">Sports les plus loggés</div></div>'+
      '<div class="stat"><div class="v">'+(stoolAvg?fr1(stoolAvg):'—')+'</div><div class="k">Selles / jour'+(domType?' · souvent type '+domType:'')+'</div></div>';

    renderWeightChart();
    renderProteinChart();
    renderActivityGraph();
    document.getElementById("bilanText").value=buildWeeklySummary();
  }

  /* ---------------- Export / Import / Reset ---------------- */
  function exportData(){
    try{
      var blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
      var url=URL.createObjectURL(blob);
      var a=document.createElement("a");a.href=url;a.download="suivi-muscu-sauvegarde-"+todayStr()+".json";
      document.body.appendChild(a);a.click();
      setTimeout(function(){URL.revokeObjectURL(url);a.remove();},0);
    }catch(e){alert("Export impossible sur ce navigateur.");}
  }
  function importData(file){
    var fr=new FileReader();
    fr.onload=function(){
      try{
        var data=JSON.parse(fr.result);
        if(typeof data!=="object"||!data)throw 0;
        state=data;if(!state.sessions)state.sessions={};if(!state.days)state.days={};if(!state.tri)state.tri={};
        save();currentSel=null;currentTri=null;
        activateTab("v-prog2");
        alert("Données importées ✓");
      }catch(e){alert("Fichier invalide.");}
    };
    fr.readAsText(file);
  }

  /* ---------------- Menu lanceur d'apps ---------------- */
  function renderApps(){
    var host=document.getElementById("appList");if(!host||typeof APPS==="undefined")return;
    host.innerHTML=APPS.map(function(a){
      var ic='<span class="app-ic">'+esc(a.icon||(a.name||"?").charAt(0))+'</span>';
      var nm='<span class="app-name">'+esc(a.name)+'</span>';
      if(a.here)return '<div class="app-item here">'+ic+nm+'</div>';
      if(a.ready&&a.url)return '<a class="app-item" href="'+esc(a.url)+'">'+ic+nm+'<span class="app-arrow">›</span></a>';
      return '<div class="app-item soon">'+ic+nm+'<span class="app-badge">bientôt</span></div>';
    }).join("");
  }
  function openDrawer(){
    var d=document.getElementById("drawer"),bg=document.getElementById("drawerBg"),btn=document.getElementById("menuBtn");
    if(!d||!bg)return;bg.hidden=false;d.hidden=false;
    requestAnimationFrame(function(){bg.classList.add("open");d.classList.add("open");});
    if(btn)btn.setAttribute("aria-expanded","true");
  }
  function closeDrawer(){
    var d=document.getElementById("drawer"),bg=document.getElementById("drawerBg"),btn=document.getElementById("menuBtn");
    if(!d||!bg)return;bg.classList.remove("open");d.classList.remove("open");
    if(btn)btn.setAttribute("aria-expanded","false");
    setTimeout(function(){bg.hidden=true;d.hidden=true;},240);
  }

  /* ---------------- Agenda / Calendrier ---------------- */
  var MOIS_LONG=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  var MOIS_AB=["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
  var DOW_KEYS=["dim","lun","mar","mer","jeu","ven","sam"];
  var calRef={y:(new Date()).getFullYear(),m:(new Date()).getMonth()};

  function dateMs(iso){return new Date(iso+"T00:00:00").getTime();}
  function diffDays(a,b){return Math.round((dateMs(a)-dateMs(b))/86400000);}
  function frDateShort(iso){var d=new Date(iso+"T00:00:00");return d.getDate()+" "+MOIS_AB[d.getMonth()];}

  function muscuInfoForDate(iso){
    var dd=diffDays(iso,MUSCU_START);if(dd<0)return null;
    var wIdx=Math.floor(dd/7),tot=0;BLOCK_ORDER.forEach(function(b){tot+=PROGRAM_BLOCKS[b].weeks;});
    if(wIdx>=tot)return null;
    var rem=wIdx,block=null,w=0;
    for(var i=0;i<BLOCK_ORDER.length;i++){var b=BLOCK_ORDER[i],wk=PROGRAM_BLOCKS[b].weeks;if(rem<wk){block=b;w=rem+1;break;}rem-=wk;}
    return {block:block,w:w};
  }
  function triInfoForDate(iso){var dd=diffDays(iso,TRI_START);if(dd<0)return null;var wIdx=Math.floor(dd/7);if(wIdx>=TRI.length)return null;return {w:wIdx+1};}
  function triLabel(disc){for(var i=0;i<TRI_DISC.length;i++)if(TRI_DISC[i][0]===disc)return TRI_DISC[i][1];return disc;}
  function triIcon(disc){return disc==="nat"?"🏊":disc==="velo"?"🚴":disc==="course"?"🏃":"•";}

  function plannedForDate(iso){
    if(typeof TRAIN_TEMPLATE==="undefined")return null;
    var slot=TRAIN_TEMPLATE[DOW_KEYS[new Date(iso+"T00:00:00").getDay()]];
    if(!slot)return null;
    if(slot.type==="muscu"){var mi=muscuInfoForDate(iso);if(!mi)return null;return {kind:"muscu",abbr:slot.code,label:"Muscu "+slot.code,icon:"💪",done:sess(mi.block,mi.w,slot.code).done};}
    if(slot.type==="tri"){var ti=triInfoForDate(iso);if(!ti)return null;var r=state.tri[ti.w+"_"+slot.disc];return {kind:"tri",abbr:triLabel(slot.disc),label:triLabel(slot.disc),icon:triIcon(slot.disc),done:!!(r&&r.done)};}
    return null;
  }
  function dayTypeOf(id){var L=(typeof DAY_TYPES!=="undefined"?DAY_TYPES:[]);for(var i=0;i<L.length;i++)if(L[i].id===(id||""))return L[i];return null;}
  function dayBlocked(iso){var t=dayTypeOf(getDayState(iso));return !!(t&&t.train===false);}

  /* Planification PROGRESSIVE : on ne fige pas les séances sur des dates.
     On enchaîne ce qui RESTE à faire à partir d'aujourd'hui, et on "remonte"
     ce qui est DÉJÀ fait sur les jours d'entraînement passés (le plus récent
     près d'aujourd'hui). Les jours bloqués sont sautés (la séance glisse au
     prochain jour dispo). Le repère devient ainsi ta progression réelle. */
  var schedCache=null;
  /* ---------- Config des activités (propre à cette app, valeurs par défaut depuis les constantes) ---------- */
  function cfgActs(){
    if(!state.config)state.config={};
    if(!state.config.activities)state.config.activities={};
    var a=state.config.activities;
    if(!a.muscu)a.muscu={enabled:true,start:MUSCU_START,name:"Musculation",desc:""};
    if(!a.tri)a.tri={enabled:true,start:TRI_START,name:"Triathlon Dinard",desc:""};
    return a;
  }
  function actEnabled(k){return cfgActs()[k].enabled!==false;}
  function actStart(k){return cfgActs()[k].start||(k==="muscu"?MUSCU_START:TRI_START);}
  function actName(k){return cfgActs()[k].name||(k==="muscu"?"Musculation":"Triathlon");}
  function setAct(k,patch){var a=cfgActs()[k];for(var p in patch)if(patch.hasOwnProperty(p))a[p]=patch[p];save();}

  function muscuSeqAll(){if(!actEnabled("muscu"))return [];var s=[];BLOCK_ORDER.forEach(function(b){var wks=PROGRAM_BLOCKS[b].weeks;for(var w=1;w<=wks;w++){CODES.forEach(function(c){s.push({kind:"muscu",block:b,w:w,code:c});});}});return s;}
  function triSeqAll(){if(!actEnabled("tri"))return [];var s=[];for(var i=0;i<TRI.length;i++){var ww=TRI[i].w;TRI_DISC.forEach(function(p){s.push({kind:"tri",w:ww,disc:p[0]});});}return s;}
  function labelize(s){if(s.kind==="muscu"){var m=sess(s.block,s.w,s.code);s.abbr=s.code;s.label="Muscu "+s.code;s.icon="💪";s.done=m.done;s.date=m.date||null;}else{var r=state.tri[s.w+"_"+s.disc];s.abbr=triLabel(s.disc);s.label=triLabel(s.disc);s.icon=triIcon(s.disc);s.done=!!(r&&r.done);s.date=(r&&r.date)||null;}return s;}
  function trackOf(iso){if(typeof TRAIN_TEMPLATE==="undefined")return null;var slot=TRAIN_TEMPLATE[DOW_KEYS[new Date(iso+"T00:00:00").getDay()]];return slot?slot.type:null;}
  function buildSchedule(){
    var map={},today=todayStr();
    var M={done:[],nodate:[],todo:[]},T={done:[],nodate:[],todo:[]};
    muscuSeqAll().forEach(function(s){labelize(s);if(s.done){(s.date?M.done:M.nodate).push(s);}else M.todo.push(s);});
    triSeqAll().forEach(function(s){labelize(s);if(s.done){(s.date?T.done:T.nodate).push(s);}else T.todo.push(s);});
    function place(iso,s){if(!map[iso])map[iso]=[];map[iso].push(s);}
    // 1) Séances faites AVEC date enregistrée → sur leur date réelle
    M.done.forEach(function(s){place(s.date,s);});
    T.done.forEach(function(s){place(s.date,s);});
    // 2) Séances à venir → en avant depuis aujourd'hui, sur les jours d'entraînement libres
    var mi=0,ti=0,cur=today,g=0;
    while((mi<M.todo.length||ti<T.todo.length)&&g<420){g++;
      if(!dayBlocked(cur)&&!map[cur]){var tr=trackOf(cur);if(tr==="muscu"&&mi<M.todo.length&&cur>=actStart("muscu"))place(cur,M.todo[mi++]);else if(tr==="tri"&&ti<T.todo.length&&cur>=actStart("tri"))place(cur,T.todo[ti++]);}
      cur=isoOf(addDays(cur,1));
    }
    // 3) Séances faites SANS date (héritage) → à rebours depuis hier, comme repli
    var md=M.nodate.length-1,tdi=T.nodate.length-1,back=isoOf(addDays(today,-1));g=0;
    while((md>=0||tdi>=0)&&g<420){g++;
      if(!dayBlocked(back)&&!map[back]){var tr2=trackOf(back);if(tr2==="muscu"&&md>=0)place(back,M.nodate[md--]);else if(tr2==="tri"&&tdi>=0)place(back,T.nodate[tdi--]);}
      back=isoOf(addDays(back,-1));
    }
    return map;
  }
  function rebuildSchedule(){schedCache=buildSchedule();}
  function sessionsOn(iso){return (schedCache&&schedCache[iso])||[];}
  function calGoMonth(delta){calRef.m+=delta;while(calRef.m<0){calRef.m+=12;calRef.y--;}while(calRef.m>11){calRef.m-=12;calRef.y++;}renderCalendars();}
  function calGoToday(){var n=new Date();calRef={y:n.getFullYear(),m:n.getMonth()};renderCalendars();}

  function startOfWeekMonday(d){var dow=d.getDay();var diff=(dow===0?-6:1-dow);var n=new Date(d);n.setDate(d.getDate()+diff);return n;}

  function legendHTML(){
    return '<div class="cal-leg"><span>🏋️ '+esc(actName("muscu"))+'</span><span>🏊🚴🏃 '+esc(actName("tri"))+'</span><span>📚 Révision</span><span><i class="lg ev-dot"></i>Événement</span><span class="lg-note">Séance faite = grisée + ✓ · touche un jour pour changer son état</span></div>';
  }
  function monthGridHTML(y,m){
    var first=new Date(y,m,1),last=new Date(y,m+1,0);
    var _rd=dscgDone(),_rdToday=todayStr();
    var cur=startOfWeekMonday(first);
    var lastEnd=startOfWeekMonday(last);lastEnd.setDate(lastEnd.getDate()+6);
    var today=todayStr();
    var dlMap={};pDeadlines().forEach(function(dl){dlMap[dl.date]=dl;});
    var html='<div class="cal"><div class="cal-dows"><div>L</div><div>M</div><div>M</div><div>J</div><div>V</div><div>S</div><div>D</div></div>';
    var guard=0;
    while(cur<=lastEnd&&guard<8){
      guard++;
      html+='<div class="cal-week">';
      for(var i=0;i<7;i++){
        var dd=new Date(cur);dd.setDate(cur.getDate()+i);var iso=isoOf(dd);
        var o=new Date(iso+"T00:00:00"),inMonth=(o.getMonth()===m),st=getDayState(iso),dl=dlMap[iso],evs=eventsOn(iso);
        var cls="cal-day";if(!inMonth)cls+=" off";if(iso===today)cls+=" today";if(st)cls+=" st-"+st;if(dl)cls+=" deadline";
        var pills=sessionsOn(iso).map(function(p){var ic=(p.kind==="muscu")?"🏋️":triIcon(p.disc);var ab=(p.kind==="muscu")?p.abbr:"";return '<span class="pill '+(p.kind==="muscu"?"p-muscu":"p-tri")+(p.done?" done":"")+'"><span class="pill-ic">'+ic+'</span>'+(ab?'<span class="pill-ab">'+esc(ab)+'</span>':'')+(p.done?'<span class="pill-ck">✓</span>':'')+'</span>';}).join("");
        var book="";
        if(dateMs(iso)<=dateMs(_rdToday)){var _rh=_rd.hasOwnProperty(iso)?_rd[iso]:null;if(_rh>0)book='<span class="cal-book" title="'+nFmt(_rh)+' h révisées">📚</span>';}
        else if(studyHoursOf(iso)>=6)book='<span class="cal-book" title="Grosse journée de révision (prévu)">📚</span>';
        var marks=(dl?'<span class="cal-dl" title="'+esc(dl.label)+'">'+(dl.icon||"🎯")+'</span>':'')+(evs.length?'<span class="ev-dot" title="'+esc(evs.map(function(e){return e.label;}).join(" · "))+'"></span>':'')+book;
        html+='<button class="'+cls+'" data-iso="'+iso+'"><span class="cal-n">'+o.getDate()+(marks?'<span class="cal-marks">'+marks+'</span>':'')+'</span><span class="cal-pills">'+pills+'</span></button>';
      }
      html+='</div>';
      cur.setDate(cur.getDate()+7);
    }
    return html+'</div>';
  }
  function monthEventsHTML(y,m){
    var ms=isoOf(new Date(y,m,1)),me=isoOf(new Date(y,m+1,0));
    var evs=pEvents().filter(function(e){var s=e.start,en=e.end||e.start;return (s>=ms&&s<=me)||(en>=ms&&en<=me)||(s<ms&&en>me);}).sort(function(a,b){return a.start<b.start?-1:1;});
    if(!evs.length)return "";
    return '<div class="calevents"><div class="sec-mini">Événements du mois</div>'+evs.map(function(e){var d=frDateShort(e.start)+(e.end&&e.end!==e.start?" → "+frDateShort(e.end):"");return '<div class="calev-row"><span class="calev-d">'+esc(d)+'</span><span class="calev-l">'+esc(e.label)+'</span></div>';}).join("")+'</div>';
  }
  function renderCalendarInto(host){
    if(!host)return;
    host.innerHTML='<div class="calwrap-inner">'+
      '<div class="calbar"><button class="navbtn calPrev" aria-label="Mois précédent">‹</button><div class="calmonth">'+MOIS_LONG[calRef.m]+' '+calRef.y+'</div><button class="navbtn calNext" aria-label="Mois suivant">›</button></div>'+
      '<div class="calhead"><button class="btn ghost calToday">Aujourd\'hui</button></div>'+
      monthGridHTML(calRef.y,calRef.m)+monthEventsHTML(calRef.y,calRef.m)+legendHTML()+'</div>';
    host.querySelectorAll(".cal-day").forEach(function(b){b.onclick=function(){openDaySheet(b.getAttribute("data-iso"));};});
    var pv=host.querySelector(".calPrev");if(pv)pv.onclick=function(){calGoMonth(-1);};
    var nx=host.querySelector(".calNext");if(nx)nx.onclick=function(){calGoMonth(1);};
    var td=host.querySelector(".calToday");if(td)td.onclick=calGoToday;
    bindSwipe(host);
  }
  /* Glissement au doigt : vers la droite = mois suivant, vers la gauche = mois précédent.
     Attaché une seule fois par conteneur (le div hôte n'est pas recréé, seul son contenu l'est). */
  function bindSwipe(host){
    if(host._swipeBound)return;host._swipeBound=true;
    var sx=null,sy=null;
    host.addEventListener("touchstart",function(e){var t=e.changedTouches[0];sx=t.clientX;sy=t.clientY;},{passive:true});
    host.addEventListener("touchend",function(e){if(sx===null)return;var t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy;sx=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4)calGoMonth(dx>0?-1:1);},{passive:true});
  }
  function calSummary(){
    var list=sessionsOn(todayStr());
    var plan=list.length?list.map(function(p){return (p.kind==="muscu"?"🏋️":triIcon(p.disc))+(p.kind==="muscu"?" "+p.abbr:"");}).join(" · "):"rien de prévu";
    return "aujourd'hui : "+plan;
  }
  function renderCalendars(){
    rebuildSchedule();
    var h=document.getElementById("homeCal");if(h){renderCalendarInto(h);h.classList.toggle("collapsed",!homeCalOpen);}
    var tg=document.getElementById("homeCalToggle");if(tg)tg.classList.toggle("open",homeCalOpen);
    var sum=document.getElementById("homeCalSummary");if(sum)sum.textContent=calSummary();
  }

  function openDaySheet(iso){
    var sheet=document.getElementById("calSheet"),bg=document.getElementById("calSheetBg");if(!sheet||!bg)return;
    var curSt=getDayState(iso);
    var plist=sessionsOn(iso);
    var planTxt=plist.length?plist.map(function(p){return p.icon+" "+p.label+(p.done?" ✓":"");}).join(" · "):"Aucune séance prévue ce jour";
    var revTxt="";
    if(dateMs(iso)<=dateMs(todayStr())){var _rd2=dscgDone();if(_rd2.hasOwnProperty(iso)){var _h=_rd2[iso];revTxt=' · 📚 '+nFmt(_h)+' h révisée'+(_h>=2?'s':'');}}
    sheet.innerHTML='<div class="sheet-handle"></div><div class="sheet-title">'+esc(frDateFull(iso))+'</div><div class="sheet-sub">'+esc(planTxt)+revTxt+'</div>'+
      '<div class="sheet-states">'+(typeof DAY_TYPES!=="undefined"?DAY_TYPES:[]).map(function(s){var on=curSt===s.id;return '<button class="st-btn st-'+(s.id||"normal")+(on?" on":"")+'" data-st="'+s.id+'">'+(s.icon?esc(s.icon)+' ':'')+esc(s.label)+'</button>';}).join("")+'</div>'+
      '<button class="sheet-link" data-go="'+iso+'">Ouvrir ce jour dans le Journal →</button>'+
      '<button class="sheet-close" id="sheetCloseBtn">Fermer</button>';
    bg.hidden=false;sheet.hidden=false;
    requestAnimationFrame(function(){bg.classList.add("open");sheet.classList.add("open");});
    sheet.querySelectorAll(".st-btn").forEach(function(b){b.addEventListener("click",function(){setDayState(iso,b.getAttribute("data-st"));renderCalendars();closeDaySheet();});});
    var go=sheet.querySelector(".sheet-link");if(go)go.addEventListener("click",function(){journalDate=iso;closeDaySheet();activateTab("v-journal");});
    var cl=document.getElementById("sheetCloseBtn");if(cl)cl.addEventListener("click",closeDaySheet);
  }
  function closeDaySheet(){var sheet=document.getElementById("calSheet"),bg=document.getElementById("calSheetBg");if(!sheet||!bg)return;bg.classList.remove("open");sheet.classList.remove("open");setTimeout(function(){bg.hidden=true;sheet.hidden=true;},240);}

  /* ---------------- Réglages (Paramétrage) ---------------- */
  var settingsEdit=null;  /* id d'échéance en édition, "new" pour ajout, ou null */
  function dlYear(iso){return new Date(iso+"T00:00:00").getFullYear();}
  function deadlineForm(d){
    var isNew=!d;
    return '<div class="set-form" data-form="'+(isNew?"new":d.id)+'">'+
      '<div class="set-form-row"><input class="set-f-icon" maxlength="3" value="'+(d?esc(d.icon||"🎯"):"🎯")+'" aria-label="Emoji"><input class="set-f-label" placeholder="Nom de l\'échéance" value="'+(d?esc(d.label):"")+'"></div>'+
      '<input type="date" class="set-f-date" value="'+(d?esc(d.date):"")+'">'+
      '<div class="set-form-btns"><button class="btn set-f-save">Enregistrer</button><button class="btn ghost set-f-cancel">Annuler</button></div>'+
    '</div>';
  }
  function wireDeadlineForm(){
    var f=document.querySelector("#settingsBody .set-form");if(!f)return;
    var id=f.getAttribute("data-form");
    f.querySelector(".set-f-cancel").onclick=function(){settingsEdit=null;renderSettings();};
    f.querySelector(".set-f-save").onclick=function(){
      var label=(f.querySelector(".set-f-label").value||"").trim();
      var date=(f.querySelector(".set-f-date").value||"").trim();
      var icon=(f.querySelector(".set-f-icon").value||"").trim()||"🎯";
      if(!label||!date){alert("Indique un nom et une date.");return;}
      if(id==="new")pAddDeadline({label:label,date:date,icon:icon});else pUpdateDeadline(id,{label:label,date:date,icon:icon});
      settingsEdit=null;renderSettings();renderCalendars();
    };
  }
  var settingsActEdit=null;  /* clé d'activité en édition ("muscu"/"tri"), ou null */
  var ACT_META={muscu:{icon:"💪"},tri:{icon:"🏊"}};
  function actToggle(k,on){return '<button class="tgl'+(on?" on":"")+'" data-tgl="'+k+'" role="switch" aria-checked="'+(on?"true":"false")+'"><span class="tgl-dot"></span></button>';}
  function actForm(k){var a=cfgActs()[k];return '<div class="act-form">'+
    '<label class="act-flabel">Nom</label><input class="act-f-name" value="'+esc(a.name||"")+'">'+
    '<label class="act-flabel">Début du programme</label><input type="date" class="act-f-start" value="'+esc(actStart(k))+'">'+
    '<label class="act-flabel">Description (optionnel)</label><textarea class="act-f-desc" rows="2" placeholder="ex. objectif, type de programme…">'+esc(a.desc||"")+'</textarea>'+
    '<div class="set-form-btns"><button class="btn act-f-save">Enregistrer</button><button class="btn ghost act-f-cancel">Annuler</button></div>'+
  '</div>';}
  function actCard(k){var a=cfgActs()[k],on=a.enabled!==false,ic=(ACT_META[k]||{}).icon||"•";
    var head='<div class="act-head"><span class="act-ic">'+ic+'</span><span class="act-name">'+esc(a.name||"")+'</span>'+actToggle(k,on)+'</div>';
    var body="";
    if(settingsActEdit===k)body='<div class="act-body">'+actForm(k)+'</div>';
    else if(on)body='<div class="act-body"><div class="act-line"><span class="act-k">Début</span><span class="act-v">'+esc(frDateShort(actStart(k)))+' '+dlYear(actStart(k))+'</span></div>'+(a.desc?'<div class="act-desc">'+esc(a.desc)+'</div>':'')+'<button class="btn ghost act-edit" data-actedit="'+k+'">Modifier</button></div>';
    return '<div class="act-card'+(on?"":" off")+'">'+head+body+'</div>';
  }
  function wireActForm(){
    var f=document.querySelector("#settingsBody .act-form");if(!f)return;
    f.querySelector(".act-f-cancel").onclick=function(){settingsActEdit=null;renderSettings();};
    f.querySelector(".act-f-save").onclick=function(){
      var k=settingsActEdit;if(!k)return;
      var name=(f.querySelector(".act-f-name").value||"").trim()||actName(k);
      var start=(f.querySelector(".act-f-start").value||"").trim()||actStart(k);
      var desc=(f.querySelector(".act-f-desc").value||"").trim();
      setAct(k,{name:name,start:start,desc:desc});settingsActEdit=null;renderSettings();renderCalendars();
    };
  }
  var settingsSessSel=null;  /* "b1_A" en édition, ou null */
  var settingsFoodSel=null;  /* clé (nom minuscule) d'aliment en correction, ou null */
  var settingsFoodOpen=false; /* section Aliments & unités repliée par défaut */
  var settingsFoodQuery=""; /* filtre de recherche de la liste d'aliments */
  var settingsSecOpen={};  /* rubriques Réglages repliées par défaut (par id) */
  function settingsSec(id,title,inner,open){return '<div class="set-sec"><button type="button" class="set-sectog'+(open?" open":"")+'" data-sec="'+id+'"><span class="set-sec-h">'+title+'</span><span class="hcol-chev">▾</span></button>'+(open?'<div class="set-secbody">'+inner+'</div>':"")+'</div>';}
  function sessExoRow(ex,i){
    return '<div class="sx-row"><div class="sx-line"><input class="sx-name" data-i="'+i+'" value="'+esc(ex.name||"")+'" placeholder="Nom de l\'exercice"><button class="sx-del" data-i="'+i+'" aria-label="Supprimer">×</button></div>'+
      '<div class="sx-line2"><input class="sx-target" data-i="'+i+'" value="'+esc(ex.target||"")+'" placeholder="ex. 4 × 8-10"><label class="sx-setslbl">séries <input type="number" min="1" max="12" class="sx-sets" data-i="'+i+'" value="'+(ex.sets||3)+'"></label></div></div>';
  }
  function renderSessEditor(host){
    var parts=settingsSessSel.split("_"),b=parts[0],c=parts[1];
    var p=progOf(b,c),custom=progIsCustom(b,c),exos=p.exos||[];
    host.innerHTML='<button class="btn ghost sess-back" id="sessBack">‹ Toutes les séances</button>'+
      '<div class="set-sec"><div class="set-sec-h">'+esc(PROGRAM_BLOCKS[b].short)+' · Séance '+c+(custom?' <span class="sess-badge">modifiée</span>':'')+'</div>'+
      '<label class="act-flabel">Nom de la séance</label><input class="sess-title" value="'+esc(p.title||"")+'">'+
      '<div class="act-flabel" style="margin-top:16px">Exercices</div>'+
      '<div class="sess-exos">'+exos.map(sessExoRow).join("")+'</div>'+
      '<button class="btn ghost sess-add" id="sessAddExo">+ Ajouter un exercice</button>'+
      '<button class="btn ghost sess-reset" id="sessReset">↺ Rétablir le contenu par défaut</button>'+
      '</div>';
    document.getElementById("sessBack").onclick=function(){settingsSessSel=null;renderSettings();};
    var ti=host.querySelector(".sess-title");if(ti)ti.addEventListener("input",function(){progOverride(b,c).title=ti.value;save();});
    host.querySelectorAll(".sx-name").forEach(function(inp){inp.addEventListener("input",function(){progOverride(b,c).exos[+inp.getAttribute("data-i")].name=inp.value;save();});});
    host.querySelectorAll(".sx-target").forEach(function(inp){inp.addEventListener("input",function(){progOverride(b,c).exos[+inp.getAttribute("data-i")].target=inp.value;save();});});
    host.querySelectorAll(".sx-sets").forEach(function(inp){inp.addEventListener("input",function(){var n=parseInt(inp.value,10);if(isNaN(n)||n<1)n=1;if(n>12)n=12;progOverride(b,c).exos[+inp.getAttribute("data-i")].sets=n;save();});});
    host.querySelectorAll(".sx-del").forEach(function(bt){bt.addEventListener("click",function(){progOverride(b,c).exos.splice(+bt.getAttribute("data-i"),1);save();renderSettings();});});
    document.getElementById("sessAddExo").onclick=function(){progOverride(b,c).exos.push({id:"u"+Date.now().toString(36),name:"",target:"3 × 10",sets:3,unit:"reps",help:""});save();renderSettings();var ni=host.querySelector(".sx-row:last-of-type .sx-name");if(ni)ni.focus();};
    var sr=document.getElementById("sessReset");if(sr)sr.onclick=function(){if(confirm("Rétablir la séance par défaut ? Les modifications de cette séance seront perdues.")){progReset(b,c);renderSettings();}};
  }
  function renderSettings(){
    var host=document.getElementById("settingsBody");if(!host)return;
    if(settingsSessSel){renderSessEditor(host);return;}
    var _cat=foodCatalog(),_lf=loggedFoods();
    var ffOpen=settingsFoodOpen||!!settingsFoodSel;
    var ffRows=_lf.map(function(nm){var k=nm.toLowerCase();var c=_cat[k]||{};var n=c.nut||{};var fixed=!!(state.foodFix&&state.foodFix[k]);
        var pu=(n.baseUnit==="g"||n.baseUnit==="ml")?((n.base||"?")+" "+n.baseUnit):("×"+(n.base||"1")+" "+(n.baseUnit||"unité"));
        var sub=(n.prot!==""&&n.prot!=null&&!isNaN(num(n.prot)))?(fr1(num(n.prot))+" g prot / "+pu):"valeurs à renseigner";
        if(settingsFoodSel===k){
          return '<div class="ff-edit" data-nm="'+esc(k)+'">'+
            '<div class="ff-name">'+esc(nm)+(fixed?' <span class="sess-badge">corrigé</span>':'')+'</div>'+
            '<div class="ff-grid">'+
              '<label>Unité<select class="ff-unit">'+unitOptions(c.unit||n.baseUnit||"g")+'</select></label>'+
              '<label>Quantité de base<input type="number" inputmode="decimal" step="any" class="ff-base" value="'+esc(n.base||"1")+'"></label>'+
              '<label>kcal (cette base)<input type="number" inputmode="decimal" step="any" class="ff-kcal" value="'+esc(n.kcal||"")+'"></label>'+
              '<label>Protéines g (cette base)<input type="number" inputmode="decimal" step="any" class="ff-prot" value="'+esc(n.prot||"")+'"></label>'+
            '</div>'+
            '<div class="ff-actions"><button class="btn accent ff-save" data-k="'+esc(k)+'">Enregistrer</button>'+(fixed?'<button class="btn ghost ff-reset" data-k="'+esc(k)+'">Rétablir</button>':'')+'<button class="btn ghost ff-cancel">Annuler</button></div>'+
            (fixed?(function(){var mc=countLoggedFood(k);return mc>0?'<div class="ff-mig"><button class="btn ghost ff-migrate" data-k="'+esc(k)+'" data-n="'+mc+'">↻ Corriger aussi les '+mc+' repas déjà notés</button><div class="ff-mig-note">Réécrit l\'historique de cet aliment avec ces valeurs (quantités conservées). Une sauvegarde est téléchargée avant.</div></div>':'';})():'')+
          '</div>';
        }
        return '<div class="set-row ff-pick" data-k="'+esc(k)+'" data-nm="'+esc(k)+'"><span class="set-ic">🍽</span><span class="set-main"><span class="set-lbl">'+esc(nm)+(fixed?' <span class="sess-badge">corrigé</span>':'')+'</span><span class="set-sub">'+esc(sub)+'</span></span><span class="sess-arrow">›</span></div>';
      });
    var fixSec='<div class="set-sec">'+
      '<button type="button" class="ff-sectog'+(ffOpen?" open":"")+'"><span class="set-sec-h">Aliments &amp; unités</span>'+(_lf.length?'<span class="ff-count">'+_lf.length+'</span>':"")+'<span class="hcol-chev">▾</span></button>'+
      (ffOpen?'<div class="ff-secbody"><p class="set-note">Corrige l\'unité et les valeurs d\'un aliment que tu logges (ex. œuf : compté par pièce, pas par gramme). La correction s\'applique à tes prochains ajouts et aux totaux du jour ; « Rétablir » l\'annule. Les repas déjà notés ne changent pas.</p>'+
        (_lf.length?'<input type="text" class="ff-search" placeholder="Rechercher un aliment…" value="'+esc(settingsFoodQuery||"")+'"><div class="ff-scroll">'+ffRows.join("")+'</div>':'<p class="muted" style="font-size:13px">Aucun aliment loggé pour l\'instant — ajoute des repas, ils apparaîtront ici.</p>')+
      '</div>':"")+
    '</div>';
    var actsInner='<p class="set-note">Active les sports que tu prépares. Désactivé, le sport disparaît du calendrier (rien n\'est supprimé). Tu peux ajuster le nom, la date de début et la description.</p>'+
      actCard("muscu")+actCard("tri");
    var rows=pDeadlines().map(function(d){
      if(settingsEdit===d.id)return deadlineForm(d);
      return '<div class="set-row"><span class="set-ic">'+esc(d.icon||"🎯")+'</span><span class="set-main"><span class="set-lbl">'+esc(d.label)+'</span><span class="set-sub">'+esc(frDateShort(d.date))+' '+dlYear(d.date)+' · J-'+Math.max(0,diffDays(d.date,todayStr()))+'</span></span><button class="set-edit" data-edit="'+d.id+'" aria-label="Modifier">✎</button><button class="set-del" data-del="'+d.id+'" aria-label="Supprimer">🗑</button></div>';
    }).join("");
    var addBlock=settingsEdit==="new"?deadlineForm(null):'<button class="btn ghost set-add" id="setAdd">+ Ajouter une échéance</button>';
    var objInner='<p class="set-note">Ajoute, modifie ou supprime tes échéances. Le compte à rebours et les repères du calendrier se mettent à jour partout (et dans tes autres apps).</p>'+
      (rows||'<p class="muted" style="font-size:13px">Aucune échéance pour le moment.</p>')+addBlock;
    var sessInner='<p class="set-note">Modifie durablement tes séances : renomme, ajoute, retire ou ajuste les exercices et les séries. (Différent de l\'ajout à la volée dans une séance, qui reste ponctuel.)</p>'+
      BLOCK_ORDER.map(function(b){return '<div class="sess-blk">'+esc(PROGRAM_BLOCKS[b].name)+'</div>'+
        CODES.map(function(c){var p=progOf(b,c);var cust=progIsCustom(b,c);
          return '<div class="set-row sess-pick" data-sess="'+b+'_'+c+'"><span class="set-ic">💪</span><span class="set-main"><span class="set-lbl">Séance '+c+(cust?' <span class="sess-badge">modifiée</span>':'')+'</span><span class="set-sub">'+esc(p.title.replace(/^S[eé]ance [A-D]\s*—\s*/,""))+' · '+(p.exos?p.exos.length:0)+' exos</span></span><span class="sess-arrow">›</span></div>';
        }).join("");
      }).join("");
    var dtInner='<p class="set-note">Un seul vocabulaire, partagé avec ton app de révisions DSCG. Touche un jour du calendrier pour lui donner un type ; il s\'applique aux deux apps (entraînement <em>et</em> heures de révision). Le type « normal » se déduit du jour (semaine / week-end).</p>'+
      (typeof DAY_TYPES!=="undefined"?DAY_TYPES:[]).filter(function(t){return t.id;}).map(function(t){
        return '<div class="dt-row"><span class="dt-ic">'+esc(t.icon||"•")+'</span><span class="dt-lbl">'+esc(t.label)+'</span><span class="dt-eff">'+(t.train===false?'pas d\'entraînement':'entraînement possible')+'</span></div>';
      }).join("");
    var bkpInner='<p class="set-note">Tes données vivent dans ce navigateur. Exporte-les de temps en temps : si tu changes de téléphone ou vides le cache, tu pourras tout réimporter.</p>'+
      '<button class="btn accent bkp-btn" id="bkpExport">⬇️ Exporter mes données</button>'+
      '<button class="btn ghost bkp-btn" id="bkpImport">⬆️ Importer une sauvegarde</button>'+
      '<div class="bkp-when">'+((state.config&&state.config.lastBackup)?('Dernière sauvegarde : '+esc(frDateShort(state.config.lastBackup))+((backupStaleDays()>=7)?' · <span class="low">pense à en refaire une</span>':'')):'<span class="low">Aucune sauvegarde encore — fais-en une.</span>')+'</div>';
    host.innerHTML=
      settingsSec("acts","Activités préparées",actsInner,!!settingsSecOpen.acts||!!settingsActEdit)+
      settingsSec("obj","Objectifs &amp; échéances",objInner,!!settingsSecOpen.obj||!!settingsEdit)+
      settingsSec("sess","Séances (personnalisation)",sessInner,!!settingsSecOpen.sess)+
      settingsSec("daytypes","Types de jour",dtInner,!!settingsSecOpen.daytypes)+
      fixSec+
      settingsSec("backup","Sauvegarde",bkpInner,!!settingsSecOpen.backup);
    host.querySelectorAll(".set-sectog").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-sec");settingsSecOpen[id]=!settingsSecOpen[id];if(id==="obj"&&!settingsSecOpen.obj)settingsEdit=null;if(id==="acts"&&!settingsSecOpen.acts)settingsActEdit=null;renderSettings();};});
    var be=document.getElementById("bkpExport");if(be)be.onclick=function(){exportBackup();renderSettings();};
    var bi=document.getElementById("bkpImport");if(bi)bi.onclick=pickImport;
    host.querySelectorAll(".sess-pick").forEach(function(b){b.onclick=function(){settingsSessSel=b.getAttribute("data-sess");renderSettings();};});
    host.querySelectorAll("[data-tgl]").forEach(function(b){b.onclick=function(){var k=b.getAttribute("data-tgl");setAct(k,{enabled:!actEnabled(k)});settingsActEdit=null;renderSettings();renderCalendars();};});
    host.querySelectorAll("[data-actedit]").forEach(function(b){b.onclick=function(){settingsActEdit=b.getAttribute("data-actedit");renderSettings();};});
    host.querySelectorAll("[data-edit]").forEach(function(b){b.onclick=function(){settingsEdit=b.getAttribute("data-edit");renderSettings();};});
    host.querySelectorAll("[data-del]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-del");if(confirm("Supprimer cette échéance ?")){pRemoveDeadline(id);settingsEdit=null;renderSettings();renderCalendars();}};});
    var sa=document.getElementById("setAdd");if(sa)sa.onclick=function(){settingsEdit="new";renderSettings();};
    var ffTog=host.querySelector(".ff-sectog");if(ffTog)ffTog.onclick=function(){settingsFoodOpen=!settingsFoodOpen;if(!settingsFoodOpen)settingsFoodSel=null;renderSettings();};
    function ffFilter(){var q=(settingsFoodQuery||"").trim().toLowerCase();host.querySelectorAll(".ff-scroll .ff-pick").forEach(function(r){var nm=r.getAttribute("data-nm")||"";r.style.display=(!q||nm.indexOf(q)>=0)?"":"none";});}
    var ffSearch=host.querySelector(".ff-search");if(ffSearch){ffSearch.addEventListener("input",function(){settingsFoodQuery=ffSearch.value;ffFilter();});ffFilter();}
    host.querySelectorAll(".ff-pick").forEach(function(b){b.onclick=function(){settingsFoodSel=b.getAttribute("data-k");renderSettings();};});
    var ffCancel=host.querySelector(".ff-cancel");if(ffCancel)ffCancel.onclick=function(){settingsFoodSel=null;renderSettings();};
    host.querySelectorAll(".ff-save").forEach(function(b){b.onclick=function(){var k=b.getAttribute("data-k");var box=b.closest(".ff-edit");if(!box)return;var fx=foodFixMap();fx[k]={unit:box.querySelector(".ff-unit").value,base:box.querySelector(".ff-base").value,kcal:box.querySelector(".ff-kcal").value,prot:box.querySelector(".ff-prot").value};save();settingsFoodSel=null;renderSettings();if(typeof renderTodayNutri==="function")renderTodayNutri();};});
    host.querySelectorAll(".ff-reset").forEach(function(b){b.onclick=function(){var k=b.getAttribute("data-k");if(state.foodFix)delete state.foodFix[k];save();settingsFoodSel=null;renderSettings();if(typeof renderTodayNutri==="function")renderTodayNutri();};});
    host.querySelectorAll(".ff-migrate").forEach(function(b){b.onclick=function(){var k=b.getAttribute("data-k"),cnt=b.getAttribute("data-n");
      if(!confirm("Réécrire "+cnt+" repas déjà notés de « "+k+" » avec les valeurs corrigées ?\n\nLes quantités sont conservées (comptées dans la nouvelle unité). Une sauvegarde va d'abord être téléchargée — réversible en la réimportant."))return;
      try{exportBackup();}catch(e){}
      var done=migrateFood(k);save();settingsFoodSel=null;renderSettings();if(typeof renderTodayNutri==="function")renderTodayNutri();
      try{alert(done+" repas mis à jour. Vérifie tes totaux ; en cas de souci, réimporte la sauvegarde téléchargée.");}catch(e){}
    };});
    wireActForm();wireDeadlineForm();
  }
  /* ---------------- Sauvegarde / restauration ---------------- */
  function readLS(k){try{return JSON.parse(localStorage.getItem(k)||"null");}catch(e){return null;}}
  function exportBackup(){
    var data={app:"coachmuscu",fmt:1,date:new Date().toISOString(),suiviMuscu_v1:readLS(KEY),planning:readLS(PKEY)};
    try{
      var blob=new Blob([JSON.stringify(data)],{type:"application/json"});
      var url=URL.createObjectURL(blob);var a=document.createElement("a");
      a.href=url;a.download="coachmuscu-sauvegarde-"+todayStr()+".json";document.body.appendChild(a);a.click();
      setTimeout(function(){URL.revokeObjectURL(url);if(a.parentNode)a.parentNode.removeChild(a);},1500);
    }catch(e){alert("Export impossible sur ce navigateur.");return;}
    if(!state.config)state.config={};state.config.lastBackup=todayStr();save();
  }
  function importBackupObj(obj){
    if(!obj||obj.app!=="coachmuscu"||!obj.suiviMuscu_v1){alert("Fichier de sauvegarde non reconnu.");return;}
    try{
      localStorage.setItem(KEY,JSON.stringify(obj.suiviMuscu_v1));
      if(obj.planning&&typeof obj.planning==="object"){pMutate(function(o){var pl=obj.planning;
        if(pl.states)Object.keys(pl.states).forEach(function(k){o.states[k]=pl.states[k];});
        if(pl.deadlines)pl.deadlines.forEach(function(d){var hit=null;o.deadlines.forEach(function(e){if(e.id===d.id)hit=e;});if(hit){hit.date=d.date;hit.label=d.label;hit.icon=d.icon;}else o.deadlines.push(d);});
        if(pl.events)pl.events.forEach(function(ev){var f=false;o.events.forEach(function(e){if(e.id===ev.id)f=true;});if(!f)o.events.push(ev);});
        if(pl.seeds)Object.keys(pl.seeds).forEach(function(k){o.seeds[k]=pl.seeds[k];});
      });}
      location.reload();
    }catch(e){alert("Import impossible : "+e.message);}
  }
  function pickImport(){
    var inp=document.createElement("input");inp.type="file";inp.accept="application/json,.json";
    inp.onchange=function(){var f=inp.files&&inp.files[0];if(!f)return;var r=new FileReader();
      r.onload=function(){try{var obj=JSON.parse(r.result);if(confirm("Importer cette sauvegarde ? Tes données actuelles de Coach Muscu seront remplacées (le calendrier partagé est fusionné, pas écrasé)."))importBackupObj(obj);}catch(e){alert("Fichier illisible.");}};
      r.readAsText(f);};
    inp.click();
  }
  function backupStaleDays(){var lb=state.config&&state.config.lastBackup;return lb?diffDays(todayStr(),lb):null;}
  function openSettings(){var s=document.getElementById("settings");if(!s)return;settingsEdit=null;settingsSessSel=null;settingsFoodSel=null;settingsFoodOpen=false;settingsFoodQuery="";settingsSecOpen={};renderSettings();s.hidden=false;requestAnimationFrame(function(){s.classList.add("open");});}
  function closeSettings(){var s=document.getElementById("settings");if(!s)return;s.classList.remove("open");setTimeout(function(){s.hidden=true;},260);}

  /* ---------------- Initialisation ---------------- */
  function init(){
    if(!STORAGE_OK){var wb=document.getElementById("warnbar");if(wb)wb.hidden=false;}
    renderApps();
    var mb=document.getElementById("menuBtn");if(mb)mb.addEventListener("click",openDrawer);
    var dcl=document.getElementById("drawerClose");if(dcl)dcl.addEventListener("click",closeDrawer);
    var dbg=document.getElementById("drawerBg");if(dbg)dbg.addEventListener("click",closeDrawer);
    var sb=document.getElementById("settingsBtn");if(sb)sb.addEventListener("click",function(){closeDrawer();openSettings();});
    var sc=document.getElementById("settingsClose");if(sc)sc.addEventListener("click",closeSettings);
    document.addEventListener("keydown",function(e){if(e.key==="Escape"){closeDrawer();closeSettings();closeDaySheet();}});
    document.querySelectorAll(".tab").forEach(function(t){t.addEventListener("click",function(){activateTab(t.getAttribute("data-view"));});});
    var hct=document.getElementById("homeCalToggle");if(hct)hct.addEventListener("click",function(){homeCalOpen=!homeCalOpen;renderCalendars();});
    var tpt=document.getElementById("triPlanToggle");if(tpt)tpt.addEventListener("click",function(){var c=document.getElementById("triPlanCard"),b=document.getElementById("triPlanBody");var open=!c.classList.contains("open");c.classList.toggle("open",open);b.classList.toggle("collapsed",!open);});
    (function(){var card=document.getElementById("todayNutri"),sp=document.getElementById("stickyProt");
      if(card&&sp&&"IntersectionObserver" in window){
        var io=new IntersectionObserver(function(es){var e=es[0];var onToday=document.getElementById("v-today").classList.contains("active");var show=onToday&&!e.isIntersecting&&e.boundingClientRect.top<60;sp.classList.toggle("show",show);},{rootMargin:"-56px 0px 0px 0px",threshold:0});
        io.observe(card);
      }})();
    var dp=document.getElementById("dayPrev"),dn=document.getElementById("dayNext");
    if(dp)dp.addEventListener("click",function(){journalDate=isoOf(addDays(journalDate,-1));renderJournal();});
    if(dn)dn.addEventListener("click",function(){var c=isoOf(addDays(journalDate,1));if(c<=todayStr()){journalDate=c;renderJournal();}});
    var csb=document.getElementById("calSheetBg");if(csb)csb.addEventListener("click",closeDaySheet);
    /* Au retour sur l'app (ou si l'autre app a modifié le store partagé), on relit et on rafraîchit. */
    document.addEventListener("visibilitychange",function(){if(!document.hidden)renderCalendars();});
    window.addEventListener("focus",function(){renderCalendars();});
    window.addEventListener("storage",function(e){if(e.key===PKEY||e.key==="memoDSCG_v1")renderCalendars();});
    var be=document.getElementById("btnExport");if(be)be.addEventListener("click",exportData);
    var fi=document.getElementById("fileImport");if(fi)fi.addEventListener("change",function(){if(this.files&&this.files[0])importData(this.files[0]);this.value="";});
    var br=document.getElementById("btnReset");if(br)br.addEventListener("click",function(){if(confirm("Tout effacer ? Action irréversible (pense à exporter avant).")){state={sessions:{},days:{},tri:{}};save();currentSel=null;currentTri=null;activateTab("v-today");}});
    var bc=document.getElementById("bilanCopy");if(bc)bc.addEventListener("click",function(){
      var ta=document.getElementById("bilanText");var txt=ta.value;
      function ok(){bc.textContent="Bilan copié ✓";setTimeout(function(){bc.textContent="Copier le bilan";},1600);}
      function fb(){try{ta.focus();ta.select();document.execCommand("copy");ok();}catch(e){}}
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(ok,fb);}else{fb();}
    });
    pEnsureSeed();pMigrateStates();pMigrateDayTypes();seedPlanOnce();loadFoodDB();
    if("serviceWorker" in navigator){try{navigator.serviceWorker.register("sw.js").catch(function(){});}catch(e){}}
    activateTab("v-today");
  }
  init();

})();
