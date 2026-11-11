diff --git a/app.js b/app.js
index dbe2f67..8923eb6 100644
--- a/app.js
+++ b/app.js
@@ -12,9 +12,16 @@
   var STORAGE_OK=(function(){try{var k="__t_"+Date.now();localStorage.setItem(k,"1");localStorage.removeItem(k);return true;}catch(e){return false;}})();
   var memStore=null;
   function load(){if(!STORAGE_OK)return memStore;try{var r=localStorage.getItem(KEY);return r?JSON.parse(r):null;}catch(e){return null;}}
-  function save(){try{var s=JSON.stringify(state);if(STORAGE_OK)localStorage.setItem(KEY,s);else memStore=state;}catch(e){}}
+  /* Sauvegarde regroupée : save() marque l'état « sale » et écrit au plus 1 fois / 200 ms ; flush forcé quand la page se ferme ou passe en arrière-plan. */
+  var saveTimer=null,saveDirty=false,saveWarned=false;
+  function persistNow(){saveDirty=false;try{var s=JSON.stringify(state);if(STORAGE_OK)localStorage.setItem(KEY,s);else memStore=state;saveWarned=false;}catch(e){if(!saveWarned){saveWarned=true;try{fqToast("⚠️ Sauvegarde impossible (stockage plein ou bloqué). Exporte tes données : Réglages > Sauvegarde.",7000);}catch(_e){}}}}
+  function save(){saveDirty=true;if(saveTimer)return;saveTimer=setTimeout(function(){saveTimer=null;if(saveDirty)persistNow();},200);}
+  function flushSave(){if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}if(saveDirty)persistNow();}
+  function dropPendingSave(){if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}saveDirty=false;}
+  if(typeof window!=="undefined"){window.addEventListener("pagehide",flushSave);window.addEventListener("beforeunload",flushSave);document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")flushSave();});}
 
   var state=load()||{sessions:{},days:{},tri:{}};
+  var SCHEMA_V=1;if(state&&typeof state.schema!=="number")state.schema=SCHEMA_V; /* version d'état : les futures migrations testent state.schema */
 
   /* ============================================================
      STORE PARTAGÉ entre toutes les apps ricardospec.github.io
@@ -113,7 +120,7 @@
   function frDateFull(iso){var d=new Date(iso+"T00:00:00");var s=JOURS[d.getDay()]+" "+d.getDate()+" "+MOIS[d.getMonth()];return s.charAt(0).toUpperCase()+s.slice(1);}
   function cumWeeks(block){var n=0;for(var i=0;i<BLOCK_ORDER.length;i++){if(BLOCK_ORDER[i]===block)break;n+=PROGRAM_BLOCKS[BLOCK_ORDER[i]].weeks;}return n;}
   function b6Monday(){var best=null;codesOf("b6").forEach(function(c){for(var w=1;w<=PROGRAM_BLOCKS.b6.weeks;w++){var s=state.sessions[sessKey("b6",w,c)];if(s&&s.date&&(!best||s.date<best))best=s.date;}});var d=new Date((best||todayStr())+"T00:00:00");d.setDate(d.getDate()-((d.getDay()+6)%7));return isoOf(d);}
-  function muscuWeekDate(block,w){if(block==="b6")return ddmm(addDays(b6Monday(),(w-1)*7));return ddmm(addDays(MUSCU_START,(cumWeeks(block)+w-1)*7));}
+  function muscuWeekDate(block,w){if(block==="b6")return ddmm(addDays(b6Monday(),(w-1)*7));if(block==="b7")return ddmm(addDays(b6Monday(),(PROGRAM_BLOCKS.b6.weeks+w-1)*7));return ddmm(addDays(MUSCU_START,(cumWeeks(block)+w-1)*7));}
   function triWeekDate(w){return ddmm(addDays(TRI_START,(w-1)*7));}
   function num(v){return parseFloat((v===undefined||v===null?"":v).toString().replace(",","."));}
   function fr1(n){return n.toFixed(1).replace(".",",");}
@@ -226,7 +233,7 @@ function fqTokens(s){var STOP={de:1,du:1,des:1,au:1,aux:1,a:1,la:1,le:1,les:1,l:
   }
 
   var fqTapWired=false;
-  function fqToast(msg){var t=document.getElementById("fqToast");if(!t){t=document.createElement("div");t.id="fqToast";t.className="fq-toast";document.body.appendChild(t);}t.textContent=msg;t.classList.add("show");clearTimeout(fqToast._t);fqToast._t=setTimeout(function(){t.classList.remove("show");},2600);}
+  function fqToast(msg,ms){var t=document.getElementById("fqToast");if(!t){t=document.createElement("div");t.id="fqToast";t.className="fq-toast";document.body.appendChild(t);}t.textContent=msg;t.classList.add("show");clearTimeout(fqToast._t);fqToast._t=setTimeout(function(){t.classList.remove("show");},ms||2600);}
   function wireFqTaps(){if(fqTapWired||typeof document==="undefined")return;fqTapWired=true;document.addEventListener("click",function(e){var b=(e.target&&e.target.closest)?e.target.closest(".fq"):null;if(!b)return;e.preventDefault();e.stopPropagation();var r=b.getAttribute("data-r");if(r)fqToast(r);});}
   function scaleNut(it){if(!it||!it.nut)return null;var base=num(it.nut.base);var q=num(it.qty);var f;
     if(!isNaN(q)&&q>0&&!isNaN(base)&&base>0&&(it.unit||"")===(it.nut.baseUnit||""))f=q/base; /* quantité explicite compatible */
@@ -512,6 +519,13 @@ function fqTokens(s){var STOP={de:1,du:1,des:1,au:1,aux:1,a:1,la:1,le:1,les:1,l:
   /* Modifie l'échéance d'un objectif : propage à o.deadline, à chaque sport, et à l'échéance partagée (dlId). */
   function objSetDeadline(id,date){var a=cfgObjs();date=(date||"").trim();for(var i=0;i<a.length;i++){if(a[i].id===id){var o=a[i];o.deadline=date;(o.sports||[]).forEach(function(s){setSportU(s,{deadline:date});});if(date){if(o.dlId)pUpdateDeadline(o.dlId,{date:date});else o.dlId=pAddDeadline({date:date,label:o.name,icon:((o.kind||"sport")==="sport"?"🏅":(o.icon||"🎯"))});}else if(o.dlId){pRemoveDeadline(o.dlId);o.dlId=null;}break;}}save();}
   /* Rafraîchit les vues de l'onglet Objectif (sous le tiroir Réglages) après une édition d'objectif. */
+  /* Échéance dépassée : pastille « Repousser au [date] / Retirer » (muscu + objectifs sport). Handlers délégués, câblés une seule fois. */
+  var dlExpWired=false;
+  function dlExpHTML(objId){return '<span class="dl-exp"><span class="dl-exp-t">⏳ Échéance dépassée</span><label class="dl-exp-b">Repousser au <input type="date" class="dl-push" data-obj="'+esc(objId)+'" min="'+todayStr()+'" aria-label="Nouvelle échéance"></label><button type="button" class="dl-clear" data-obj="'+esc(objId)+'">Retirer</button></span>';}
+  function dlExpApply(id,date){objSetDeadline(id,date);syncTri();renderSettings();renderCalendars();refreshSportViews();}
+  function wireDlExpired(){if(dlExpWired||typeof document==="undefined")return;dlExpWired=true;
+    document.addEventListener("click",function(e){var t=e.target&&e.target.closest?e.target.closest(".dl-exp"):null;if(!t)return;e.stopPropagation();var b=e.target.closest(".dl-clear");if(b)dlExpApply(b.getAttribute("data-obj"),"");},true);
+    document.addEventListener("change",function(e){var i=e.target;if(!i||!i.classList||!i.classList.contains("dl-push")||!i.value)return;dlExpApply(i.getAttribute("data-obj"),i.value);},true);}
   function refreshSportViews(){renderSportObjectives();renderSportTabs();renderProgram();renderTri();}
   function migrateObjLinks(){var objs=cfgObjs(),dls=(pLoad().deadlines||[]),changed=false;objs.forEach(function(o){if(o.dlId||!o.deadline)return;var ex=dls.filter(function(d){return d.label===o.name;})[0];if(ex){o.dlId=ex.id;if(ex.date!==o.deadline)pUpdateDeadline(ex.id,{date:o.deadline});}else{o.dlId=pAddDeadline({date:o.deadline,label:o.name,icon:o.icon||"🏅"});}changed=true;});if(changed)save();}
   function curSportForDl(dlId){var o=cfgObjs().filter(function(x){return x.dlId===dlId;})[0];return (o&&(o.sports||[])[0])||"";}
@@ -670,7 +684,7 @@ function fqTokens(s){var STOP={de:1,du:1,des:1,au:1,aux:1,a:1,la:1,le:1,les:1,l:
       var paliers=[];for(var lv=cur+1;lv<=tgt;lv++)paliers.push(lv);
       if(!paliers.length){return '<div class="card pad so-card'+(selSports[id]?" sel":"")+(paneCollapse[id]!==false?" collapsed":"")+'" data-sport="'+esc(id)+'"><h2 class="page pane-title">'+esc(ic)+' '+esc(nm)+'</h2><p class="hint" style="margin:8px 0 0">Choisis ton <b>niveau visé</b> dans Réglages → Objectifs &amp; sports : ton programme et tes séances apparaîtront ici.</p></div>';}
       var idx=Math.max(0,Math.min(paliers.length-1,sportLvlNav[id]||0)),lvN=paliers[idx],L=(sp.levels||[])[lvN]||{};
-      var dlSub=ddl?('<span class="pane-sub'+(dlPast(ddl)?' past':'')+'">'+dlTxt(ddl)+' · '+esc(frDateShort(ddl))+'</span>'):'';
+      var dlSub=ddl?('<span class="pane-sub'+(dlPast(ddl)?' past':'')+'">'+dlTxt(ddl)+' · '+esc(frDateShort(ddl))+'</span>'):'';if(ddl&&dlPast(ddl)&&obj&&obj.id)dlSub+=dlExpHTML(obj.id);
       var days=(uc.days||[]).slice(),mins=num(uc.minutes)||45,themes=(L.focus&&L.focus.length)?L.focus:["Séance libre"];
       var sess=sportSessions(id,lvN),isCustom=!!sportSessCustom(id,lvN);
       if(sportPlanCache===null)rebuildSportPlan();
@@ -825,7 +839,7 @@ function fqTokens(s){var STOP={de:1,du:1,des:1,au:1,aux:1,a:1,la:1,le:1,les:1,l:
     var pm=document.getElementById("sportMuscu"),pt=document.getElementById("sportTri");
     var mOn=actEnabled("muscu"),tOn=actEnabled("tri");
     if(pm)pm.hidden=!mOn;if(pt)pt.hidden=!tOn;
-    var mt=document.getElementById("muscuTitle");if(mt){var mDl=(muscuLink()||{}).deadline||"";mt.innerHTML='💪 '+esc(actName("muscu"))+' <button type="button" class="pane-ren" data-ren="muscu" aria-label="Renommer">✎</button>'+(mDl?'<span class="pane-sub'+(dlPast(mDl)?' past':'')+'">'+dlTxt(mDl)+' · '+esc(frDateShort(mDl))+'</span>':'');}
+    var mt=document.getElementById("muscuTitle");if(mt){var mDl=(muscuLink()||{}).deadline||"";mt.innerHTML='💪 '+esc(actName("muscu"))+' <button type="button" class="pane-ren" data-ren="muscu" aria-label="Renommer">✎</button>'+(mDl?'<span class="pane-sub'+(dlPast(mDl)?' past':'')+'">'+dlTxt(mDl)+' · '+esc(frDateShort(mDl))+'</span>':'')+(mDl&&dlPast(mDl)&&muscuLink()?dlExpHTML(muscuLink().id):'');}
     var tt=document.getElementById("triTitle");if(tt){var tDl=triRaceDate(),_tl=triLink(),tName=(_tl&&_tl.name)||actName("tri");tt.innerHTML='🏊 '+esc(tName)+' <button type="button" class="pane-ren" data-ren="tri" aria-label="Renommer">✎</button><button type="button" class="pane-arc" data-arc="tri" aria-label="Archiver" title="Archiver">🗄️</button>'+(tDl?'<span class="pane-sub'+(dlPast(tDl)?' past':'')+'">'+dlTxt(tDl)+' · '+esc(frDateShort(tDl))+'</span>':'');}
     var _sh=document.getElementById("sportSectionH");if(_sh){var _anySport=mOn||tOn;if(!_anySport&&typeof SPORTS_LIB!=="undefined"&&SPORTS_LIB)_anySport=(SPORTS_LIB.order||[]).some(function(id){return id!=="muscu"&&sportUCfg(id).on===true;});_sh.hidden=!_anySport;}
     if(pm)pm.classList.toggle("collapsed",paneCollapse.muscu!==false);
@@ -2056,7 +2070,7 @@ function fqTokens(s){var STOP={de:1,du:1,des:1,au:1,aux:1,a:1,la:1,le:1,les:1,l:
   var pxAllOpen=false;
 
   function hrvVal(iso){var x=state.days[iso];if(!x||x.hrv==null||x.hrv==="")return null;var v=parseFloat((""+x.hrv).replace(",","."));return v===v?v:null;}
-  function hrvSeries(d,n){var out=[],base=new Date(d+"T00:00:00");for(var i=n-1;i>=0;i--){var dt=new Date(base);dt.setDate(dt.getDate()-i);var iso=dt.toISOString().slice(0,10);out.push({iso:iso,v:hrvVal(iso)});}return out;}
+  function hrvSeries(d,n){var out=[],base=new Date(d+"T00:00:00");for(var i=n-1;i>=0;i--){var dt=new Date(base);dt.setDate(dt.getDate()-i);var iso=isoOf(dt);out.push({iso:iso,v:hrvVal(iso)});}return out;}
   function renderHrvTrend(container,d){
     var host=container.querySelector(".hrv-trend");if(!host)return;
     var ser=hrvSeries(d,14);
@@ -3818,7 +3832,7 @@ var P=sportPlan(),pd=num(P.perDay)||1,mc=num(P.maxConsec)||3;
   /* ---------------- Sauvegarde / restauration ---------------- */
   function readLS(k){try{return JSON.parse(localStorage.getItem(k)||"null");}catch(e){return null;}}
   function exportBackup(){
-    var data={app:"coachmuscu",fmt:1,date:new Date().toISOString(),suiviMuscu_v1:readLS(KEY),planning:readLS(PKEY)};
+    var data={app:"coachmuscu",fmt:1,date:new Date().toISOString(),suiviMuscu_v1:(flushSave(),readLS(KEY)),planning:readLS(PKEY)};
     try{
       var blob=new Blob([JSON.stringify(data)],{type:"application/json"});
       var url=URL.createObjectURL(blob);var a=document.createElement("a");
@@ -3829,8 +3843,9 @@ var P=sportPlan(),pd=num(P.perDay)||1,mc=num(P.maxConsec)||3;
   }
   function importBackupObj(obj){
     if(!obj||obj.app!=="coachmuscu"||!obj.suiviMuscu_v1){alert("Fichier de sauvegarde non reconnu.");return;}
+    if(typeof obj.suiviMuscu_v1.schema==="number"&&obj.suiviMuscu_v1.schema>SCHEMA_V){alert("Cette sauvegarde vient d'une version plus récente de l'app : mets l'app à jour avant de l'importer.");return;}
     try{
-      localStorage.setItem(KEY,JSON.stringify(obj.suiviMuscu_v1));
+      dropPendingSave();localStorage.setItem(KEY,JSON.stringify(obj.suiviMuscu_v1));
       if(obj.planning&&typeof obj.planning==="object"){pMutate(function(o){var pl=obj.planning;
         if(pl.states)Object.keys(pl.states).forEach(function(k){o.states[k]=pl.states[k];});
         if(pl.deadlines)pl.deadlines.forEach(function(d){var hit=null;o.deadlines.forEach(function(e){if(e.id===d.id)hit=e;});if(hit){hit.date=d.date;hit.label=d.label;hit.icon=d.icon;}else o.deadlines.push(d);});
@@ -3943,7 +3958,7 @@ var P=sportPlan(),pd=num(P.perDay)||1,mc=num(P.maxConsec)||3;
     document.addEventListener("keydown",function(e){if(e.key==="Escape"){closeDrawer();closeSettings();closeDaySheet();}});
     document.querySelectorAll(".tab").forEach(function(t){t.addEventListener("click",function(){activateTab(t.getAttribute("data-view"));});});wireSwipe();
     window.addEventListener("resize",function(){if(currentSel)setExoStickyTop();});
-    wireBnd();wireAxis();wireStick();syncStickTop();wireFqTaps();loadFoodDB();
+    wireBnd();wireAxis();wireStick();syncStickTop();wireFqTaps();wireDlExpired();if(!STORAGE_OK)fqToast("⚠️ Stockage bloqué : tes données ne seront pas conservées (navigation privée ?).",7000);loadFoodDB();
     var tpt=document.getElementById("triPlanToggle");if(tpt)tpt.addEventListener("click",function(){var c=document.getElementById("triPlanCard"),b=document.getElementById("triPlanBody");var open=!c.classList.contains("open");c.classList.toggle("open",open);b.classList.toggle("collapsed",!open);});
     var dp=document.getElementById("dayPrev"),dn=document.getElementById("dayNext");
     var dlb=document.getElementById("dayLabel");if(dlb)dlb.addEventListener("click",function(){if(dayDate!==todayStr()){dayDate=todayStr();renderDay();window.scrollTo(0,0);}});
diff --git a/data.js b/data.js
index daaf96a..1e67080 100644
--- a/data.js
+++ b/data.js
@@ -265,9 +265,11 @@ var PROGRAM_BLOCKS = {
   b4:{name:"Foncier",      short:"B4", weeks:12, codes:["A","B","C","D","E"],             prog:PROGRAM4},
   b5:{name:"Spécifique",   short:"B5", weeks:10, codes:["A","B","C","D","E","F"],         prog:PROGRAM5},
   b6:{name:"Développement haut du corps", short:"B6", weeks:2, codes:["A","C"], prog:PROGRAM6,
-       focus:"Pecs, bras, dos sculpté + taille en V : épaules et dos larges (tractions, élévations latérales) au-dessus d'une taille fine. Les abdos se travaillent en gainage et relevés, sans charges lourdes sur les obliques (elles épaississent la taille)."}
+       focus:"Pecs, bras, dos sculpté + taille en V : épaules et dos larges (tractions, élévations latérales) au-dessus d'une taille fine. Les abdos se travaillent en gainage et relevés, sans charges lourdes sur les obliques (elles épaississent la taille)."},
+  b7:{name:"Entretien haut du corps", short:"B7", weeks:8, codes:["A","C"], prog:PROGRAM6,
+       focus:"Même programme que B6, étalé sur la durée : surcharge progressive (+1-2 reps, puis +2 kg quand toutes les séries sont réussies). C'est la régularité, pas 2 semaines, qui construit le haut du corps. À décaler ou arrêter quand tu veux."}
 };
-var BLOCK_ORDER = ["b1","b2","b3","b4","b5","b6"];
+var BLOCK_ORDER = ["b1","b2","b3","b4","b5","b6","b7"];
 var CODES = ["A","B","C","D"];
 
 /* ---------- Dates d'ancrage ---------- */
diff --git a/index.html b/index.html
index 1c0ac1e..604d56f 100644
--- a/index.html
+++ b/index.html
@@ -13,7 +13,7 @@
   <link rel="shortcut icon" href="favicon.ico">
   <link rel="apple-touch-icon" href="apple-touch-icon.png">
   <!-- Styles externes -->
-  <link rel="stylesheet" href="style.css?v=234">
+  <link rel="stylesheet" href="style.css?v=235">
 </head>
 <body>
 
@@ -189,8 +189,8 @@
   <!-- ====================== SCRIPTS ======================
        Ordre important : data.js (variables PROGRAM, PROGRAM2, TRI, BRISTOL…)
        doit être chargé AVANT app.js (logique, rendu, stockage). -->
-  <script src="data.js?v=234"></script>
-  <script src="sports.js?v=234"></script>
-  <script src="app.js?v=234"></script>
+  <script src="data.js?v=235"></script>
+  <script src="sports.js?v=235"></script>
+  <script src="app.js?v=235"></script>
 </body>
 </html>
diff --git a/style.css b/style.css
index 7872e2a..b2d17e0 100644
--- a/style.css
+++ b/style.css
@@ -1724,3 +1724,10 @@ nav.tabs .tab.on{color:var(--primary)}
 .dscg-arc{flex:none;background:none;border:0;cursor:pointer;opacity:.4;font-size:16px;padding:8px 6px}
 .dscg-arc:hover{opacity:1}
 .blk-focus{font-size:13px;line-height:1.45;background:#eef4f8;border-radius:10px;padding:9px 11px;margin:0 0 10px}
+
+/* Échéance dépassée */
+.dl-exp{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:8px;font-size:12.5px;font-weight:400;line-height:1.3}
+.dl-exp-t{color:#b45f06;font-weight:700}
+.dl-exp-b{display:inline-flex;align-items:center;gap:6px;color:var(--muted)}
+.dl-push{font:inherit;font-size:13px;border:1px solid var(--line);border-radius:8px;padding:4px 6px;background:var(--bg2,#fff);color:var(--ink)}
+.dl-clear{border:1px solid var(--line);border-radius:8px;background:var(--bg2,#fff);padding:5px 10px;font-size:12.5px;cursor:pointer;color:var(--muted)}
diff --git a/sw.js b/sw.js
index fd9926a..987a357 100644
--- a/sw.js
+++ b/sw.js
@@ -1,7 +1,7 @@
 /* Coach Muscu — service worker.
    Stratégie RÉSEAU D'ABORD : en ligne, on sert toujours la version fraîche (et on met le cache à jour) ;
    hors-ligne, on sert la dernière version vue. ignoreSearch permet au cache de matcher malgré les ?v=N. */
-var CACHE = "coachmuscu-runtime-v234";
+var CACHE = "coachmuscu-runtime-v235";
 
 self.addEventListener("install", function () { self.skipWaiting(); });
