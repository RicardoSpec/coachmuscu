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

  /* ---------------- Divers ---------------- */
  function slugify(s){return (""+s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");}
  function esc(s){return (""+(s==null?"":s)).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

  /* ---------------- Repas / aliments ---------------- */
  var MEALS=[{k:"pd",label:"Petit-déjeuner"},{k:"dj",label:"Déjeuner"},{k:"dn",label:"Dîner"},{k:"co",label:"Collation"}];
  var FOOD_UNITS=["g","ml","unité","portion","c. à s.","c. à c."];
  function unitOptions(sel){return FOOD_UNITS.map(function(u){return '<option value="'+u+'"'+(sel===u?' selected':'')+'>'+u+'</option>';}).join("");}
  function foodCatalog(){var cat={};Object.keys(state.days).sort().forEach(function(d){var mi=state.days[d].mealItems;if(!mi)return;MEALS.forEach(function(m){(mi[m.k]||[]).forEach(function(it){if(it&&it.name&&(""+it.name).trim()){cat[(""+it.name).trim().toLowerCase()]={name:(""+it.name).trim(),unit:it.unit||"g",nut:it.nut||null};}});});});return cat;}
  function foodNames(){var c=foodCatalog();return Object.keys(c).map(function(k){return c[k].name;}).sort(function(a,b){return a.toLowerCase()<b.toLowerCase()?-1:1;});}
  function scaleNut(it){if(!it||!it.nut)return null;var base=num(it.nut.base),q=num(it.qty);if(isNaN(base)||base<=0||isNaN(q)||q<=0)return null;if((it.unit||"")!==(it.nut.baseUnit||""))return null;var f=q/base,r={};var kc=num(it.nut.kcal),pr=num(it.nut.prot);if(!isNaN(kc))r.kcal=kc*f;if(!isNaN(pr))r.prot=pr*f;if(r.kcal===undefined&&r.prot===undefined)return null;return r;}
  function dayTotals(d){var x=state.days[d];if(!x||!x.mealItems)return null;var k=0,p=0,any=false;MEALS.forEach(function(m){(x.mealItems[m.k]||[]).forEach(function(it){var s=scaleNut(it);if(s){any=true;if(s.kcal)k+=s.kcal;if(s.prot)p+=s.prot;}});});return any?{kcal:k,prot:p}:null;}

  /* ---------------- Objectifs ---------------- */
  var MUSCU_DEADLINE="2026-07-27";
  var RACE_DATE="2026-09-11";
  function blockDone(b){var n=0,wk=PROGRAM_BLOCKS[b].weeks;for(var w=1;w<=wk;w++)for(var i=0;i<CODES.length;i++)if(sess(b,w,CODES[i]).done)n++;return n;}
  function daysUntil(iso){return Math.round((new Date(iso+"T00:00:00")-new Date(todayStr()+"T00:00:00"))/86400000);}

  /* ---------------- Séances (multi-blocs) ---------------- */
  function sessKey(b,w,c){return b==="b1"?(w+"_"+c):(b+"_"+w+"_"+c);}
  function sess(b,w,c){var k=sessKey(b,w,c);if(!state.sessions[k])state.sessions[k]={done:false,sets:{}};return state.sessions[k];}
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
  function activateTab(id){
    var t;
    document.querySelectorAll(".tab").forEach(function(x){x.classList.toggle("on",x.getAttribute("data-view")===id);});
    document.querySelectorAll(".view").forEach(function(v){v.classList.toggle("active",v.id===id);});
    if(id==="v-today")renderToday();
    else if(id==="v-prog")renderProgram();
    else if(id==="v-tri")renderTri();
    else if(id==="v-journal")renderJournal();
    else if(id==="v-prog2")renderProgress();
    window.scrollTo(0,0);
  }

  /* ---------------- En-tête ---------------- */
  function renderChip(){var n=nextSession();document.getElementById("wkChip").textContent=(n?(PROGRAM_BLOCKS[n.block].short+" · S"+n.w):"Fini")+" · "+doneCount()+"/"+totalSessions();}

  /* ---------------- Aujourd'hui ---------------- */
  function renderToday(){
    renderChip();
    var n=nextSession();var hero=document.getElementById("heroCard");
    var tip=phaseTip(todayStr());
    var tipHTML='<div class="tip"><div class="t">'+tip.t+'</div><p>'+tip.p+'</p></div>';
    if(n){
      var blk=PROGRAM_BLOCKS[n.block];var p=blk.prog[n.c];
      hero.innerHTML=
        '<div class="lbl">Prochaine séance muscu</div>'+
        '<div class="stitle">'+blk.name+' · Semaine '+n.w+' · '+p.sub+'</div>'+
        '<h2>'+p.title.split("—")[0].trim()+' <span class="num">'+n.c+'</span></h2>'+
        '<div class="meta">'+p.exos.length+' exercices · semaine '+n.w+'/'+blk.weeks+'</div>'+
        '<div class="row2"><button class="btn accent" id="goSession">Ouvrir la séance</button>'+
        '<button class="btn ghost" id="quickDone">Marquer faite</button></div>'+
        tipHTML;
      document.getElementById("goSession").addEventListener("click",function(){currentSel={block:n.block,w:n.w,c:n.c};activateTab("v-prog");var sd=document.getElementById("sessionDetail");if(sd&&sd.scrollIntoView)sd.scrollIntoView({behavior:"smooth",block:"start"});});
      document.getElementById("quickDone").addEventListener("click",function(){var s=sess(n.block,n.w,n.c);s.done=true;if(!s.date)s.date=todayStr();save();renderToday();});
    }else{
      hero.innerHTML='<div class="lbl">Bravo</div><h2>Programme muscu terminé 🎉</h2><div class="meta">'+totalSessions()+' séances bouclées. Relance un cycle en augmentant les charges.</div>'+tipHTML;
    }
    buildDayForm(document.getElementById("todayLog"),todayStr());
  }

  /* ---------------- Muscu (grilles) ---------------- */
  function buildGrid(block){
    var blk=PROGRAM_BLOCKS[block];var n=nextSession();
    var h='<div class="card pad">'+
      '<div class="sec-title">'+blk.name+' <span class="muted" style="font-weight:600">· '+blk.weeks+' sem.</span></div>'+
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
    h+="</table></div>";
    return h;
  }
  function renderProgram(){
    renderChip();
    var host=document.getElementById("progBlocks");
    host.innerHTML=BLOCK_ORDER.map(buildGrid).join("");
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
    var p=PROGRAM_BLOCKS[b].prog[c];var s=sess(b,w,c);
    var head=
      '<div class="eyebrow">Séance ouverte</div>'+
      '<div class="card pad">'+
      '<div class="sd-head"><div><div class="lbl">'+PROGRAM_BLOCKS[b].name+' · Semaine '+w+' · '+p.sub+'</div>'+
      '<h3>'+p.title.replace(/—.*/,"").trim()+' '+c+'</h3></div></div>'+
      '<div class="field" style="margin-top:12px"><button class="btn '+(s.done?'ghost':'accent')+'" id="toggleDone">'+(s.done?'✓ Séance faite — annuler':'Marquer la séance comme faite')+'</button></div>'+
      '<div class="rest"><div class="rest-disp" id="restDisp">0:00</div><div class="rest-btns">'+
        '<button data-sec="30">30 s</button><button data-sec="60">1:00</button><button data-sec="120">2:00</button><button class="stop" id="restStop">Stop</button>'+
      '</div></div>';
    var exosHTML="";
    p.exos.forEach(function(ex){
      if(!s.sets[ex.id])s.sets[ex.id]=[];
      var prev=prevSets(b,w,c,ex.id);
      var u=ex.unit==="sec"?"sec":"reps";
      var rest=restFor(ex.target);
      var setsHTML="";
      for(var i=0;i<ex.sets;i++){
        var pk=(prev&&prev[i]&&prev[i].kg!=="")?prev[i].kg:"kg";
        var pr=(prev&&prev[i]&&prev[i].r!=="")?prev[i].r:u;
        setsHTML+='<div class="set" data-exo="'+ex.id+'" data-set="'+i+'">'+
          '<span class="sn">Série '+(i+1)+'</span>'+
          '<input type="number" inputmode="decimal" step="0.5" class="in-kg" placeholder="'+pk+'">'+
          '<input type="number" inputmode="numeric" class="in-r" placeholder="'+pr+'">'+
        '</div>';
      }
      var lastTxt="";
      if(prev){lastTxt=prev.map(function(x){var kg=(x&&x.kg!=="")?x.kg:"–";var r=(x&&x.r!=="")?x.r:"–";return kg+"×"+r;}).join(" · ");}
      exosHTML+=
        '<div class="exo" data-ex="'+ex.id+'">'+
          '<div class="exo-top"><div class="nm">'+ex.name+'</div>'+
            '<div style="display:flex;align-items:center;gap:8px"><span class="tg">'+ex.target+'</span>'+
            '<button class="info-btn" data-help="'+ex.id+'" aria-label="Aide">i</button></div></div>'+
          (lastTxt?'<div class="lastrep">Dernière fois : '+lastTxt+'</div>':'')+
          '<img class="exo-img" src="./images/'+slugify(ex.name)+'.jpg" alt="" onerror="this.style.display=\'none\'">'+
          '<div class="help" id="help-'+ex.id+'">'+ex.help+
            '<div class="exo-media"><a class="demo-link" href="https://www.youtube.com/results?search_query='+encodeURIComponent(ex.name+" musculation technique")+'" target="_blank" rel="noopener">▸ Voir une démo vidéo</a></div>'+
          '</div>'+
          '<div class="sets">'+setsHTML+'</div>'+
          '<button class="rest-chip" data-sec="'+rest+'">⏱ Repos conseillé : '+rest+' s</button>'+
        '</div>';
    });
    var wrap=document.getElementById("sessionDetail");
    wrap.innerHTML=head+exosHTML+'</div>';

    wrap.querySelectorAll(".set").forEach(function(row){
      var exo=row.getAttribute("data-exo");var idx=parseInt(row.getAttribute("data-set"),10);
      var rec=(s.sets[exo]&&s.sets[exo][idx])||{kg:"",r:""};
      row.querySelector(".in-kg").value=rec.kg||"";
      row.querySelector(".in-r").value=rec.r||"";
      function upd(){if(!s.sets[exo])s.sets[exo]=[];while(s.sets[exo].length<=idx)s.sets[exo].push({kg:"",r:""});s.sets[exo][idx]={kg:row.querySelector(".in-kg").value,r:row.querySelector(".in-r").value};save();}
      row.querySelector(".in-kg").addEventListener("input",upd);
      row.querySelector(".in-r").addEventListener("input",upd);
    });
    wrap.querySelectorAll(".info-btn").forEach(function(btn){btn.addEventListener("click",function(){document.getElementById("help-"+btn.getAttribute("data-help")).classList.toggle("open");});});
    wrap.querySelectorAll(".rest-chip").forEach(function(ch){ch.addEventListener("click",function(){startRest(parseInt(ch.getAttribute("data-sec"),10));});});
    wrap.querySelectorAll(".rest-btns button[data-sec]").forEach(function(bt){bt.addEventListener("click",function(){startRest(parseInt(bt.getAttribute("data-sec"),10));});});
    var rs=wrap.querySelector("#restStop");if(rs)rs.addEventListener("click",stopRest);
    wrap.querySelector("#toggleDone").addEventListener("click",function(){s.done=!s.done;if(s.done&&!s.date)s.date=todayStr();save();renderProgram();renderSessionDetail();});
  }

  /* ---------------- Triathlon ---------------- */
  function renderTri(){
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
        '<div class="field"><label>Réalisé (optionnel)</label><input type="text" class="t-val" placeholder="ex : 1300 m · 1h20 · 8,5 km"></div>'+
        '<div class="field"><label>Ressenti / notes</label><textarea class="t-note" placeholder="sensations, allure, météo…"></textarea></div>'+
      '</div>';
    wrap.querySelector(".t-val").value=rec.val||"";
    wrap.querySelector(".t-note").value=rec.note||"";
    wrap.querySelector(".t-val").addEventListener("input",function(){rec.val=this.value;save();});
    wrap.querySelector(".t-note").addEventListener("input",function(){rec.note=this.value;save();});
    wrap.querySelector("#triDone").addEventListener("click",function(){rec.done=!rec.done;if(rec.done&&!rec.date)rec.date=todayStr();save();renderTri();renderTriDetail();});
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
  }

  /* ---------------- Formulaire de journée ---------------- */
  function buildDayForm(container,d){
    var x=day(d);
    var dlId="foodlist-"+(container.id||"x");
    var chips='<div class="chips">'+SPORTS.map(function(sp){return '<button type="button" class="chip'+(x.sports.indexOf(sp)>-1?' on':'')+'" data-sport="'+sp+'">'+sp+'</button>';}).join("")+'</div>';
    container.innerHTML=
      '<div class="card pad">'+
        '<div class="field"><label>Sports du jour</label>'+chips+'</div>'+
        '<div class="field"><label>Poids (kg)</label><input type="number" inputmode="decimal" step="0.1" class="f-weight" placeholder="ex : 68,4"></div>'+
        '<div class="field"><label>Sommeil (h)</label><input type="number" inputmode="decimal" step="0.5" class="f-sleep" placeholder="ex : 7,5"></div>'+
        '<div class="field"><label>Hydratation — verres d\'eau</label><div class="water"><button type="button" class="wbtn wminus">−</button><span class="wcount">0</span><button type="button" class="wbtn wplus">+</button><span class="wml"></span></div></div>'+
        '<div class="field"><label>Repas</label>'+
          '<datalist id="'+dlId+'">'+foodNames().map(function(n){return '<option value="'+esc(n)+'">';}).join("")+'</datalist>'+
          MEALS.map(function(m){return '<div class="meal"><div class="meal-h">'+m.label+'</div><div class="meal-items" data-mk="'+m.k+'"></div></div>';}).join("")+
          '<div class="meal-total"></div>'+
        '</div>'+
        '<div class="field"><label class="check"><input type="checkbox" class="f-medit"> Méditation faite</label></div>'+
        '<div class="field"><label>Transit — passages à la selle</label><div class="stools f-stools"></div></div>'+
        '<div class="field"><label>Note du jour</label><textarea class="f-note" placeholder="ressenti, énergie, douleurs…"></textarea></div>'+
      '</div>';

    container.querySelector(".f-weight").value=x.weight||"";
    container.querySelector(".f-sleep").value=x.sleep||"";
    container.querySelector(".f-medit").checked=!!x.meditation;
    container.querySelector(".f-note").value=x.note||"";

    container.querySelector(".f-weight").addEventListener("input",function(){x.weight=this.value;save();});
    container.querySelector(".f-sleep").addEventListener("input",function(){x.sleep=this.value;save();});
    container.querySelector(".f-medit").addEventListener("change",function(){x.meditation=this.checked;save();});
    container.querySelector(".f-note").addEventListener("input",function(){x.note=this.value;save();});
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
    function recalcTotals(){var t=dayTotals(d);var el=container.querySelector(".meal-total");if(!el)return;if(t){el.textContent="Total du jour (estimé) : "+Math.round(t.kcal)+" kcal · "+fr1(t.prot)+" g protéines";el.className="meal-total on";}else{el.textContent="Tape un aliment puis Entrée. Touche une étiquette pour ses valeurs nutritionnelles.";el.className="meal-total";}}
    var mealEdit={pd:-1,dj:-1,dn:-1,co:-1};
    function renderMeal(mk){
      var host=container.querySelector('.meal-items[data-mk="'+mk+'"]');
      var arr=day(d).mealItems[mk];var ed=mealEdit[mk];var h="";
      h+='<div class="tags">';
      arr.forEach(function(it,i){
        h+='<span class="tag'+(ed===i?" on":"")+(it.nut?" has-nut":"")+'" data-i="'+i+'">'+esc(it.name||"—")+'<button type="button" class="tag-x" data-i="'+i+'" aria-label="Supprimer">×</button></span>';
      });
      h+='</div>';
      h+='<input type="text" class="tag-input" list="'+dlId+'" placeholder="Aliment puis Entrée…" enterkeyhint="done">';
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
      inp.addEventListener("keydown",function(e){
        if(e.key==="Enter"||e.keyCode===13){e.preventDefault();var v=this.value.trim();if(!v)return;
          var nit={name:v,qty:"",unit:"g",nut:null};var hit=foodCatalog()[v.toLowerCase()];
          if(hit&&hit.nut){nit.nut=JSON.parse(JSON.stringify(hit.nut));nit.unit=hit.unit||"g";}
          day(d).mealItems[mk].push(nit);this.value="";save();renderMeal(mk);recalcTotals();
          var ni=host.querySelector(".tag-input");if(ni)ni.focus();
        }
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
    function goal(title,sub,done,total,dleft){
      var pct=total?Math.round(done/total*100):0;var remain=Math.max(0,total-done);
      return '<div class="goal">'+
        '<div class="goal-head"><div class="goal-name">'+title+'</div><span class="goal-badge">'+dtxt(dleft)+'</span></div>'+
        '<div class="goal-sub">'+sub+'</div>'+
        '<div class="bar"><div class="bar-fill" style="width:'+Math.max(0,Math.min(100,pct))+'%"></div></div>'+
        '<div class="goal-meta"><b>'+pct+'%</b> · '+done+'/'+total+' séances · '+remain+' restante'+(remain>1?"s":"")+'</div>'+
      '</div>';
    }
    host.innerHTML='<div class="card pad"><div class="sec-title">Objectifs</div>'+
      goal("💪 Muscu — Bloc 1","obj. 27 juil.",blockDone("b1"),PROGRAM_BLOCKS.b1.weeks*CODES.length,daysUntil(MUSCU_DEADLINE))+
      goal("🏊 Triathlon — Dinard","course 11-13 sept.",triDoneCount(),30,daysUntil(RACE_DATE))+
    '</div>';
  }

  function renderProgress(){
    renderGoals();
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

  /* ---------------- Initialisation ---------------- */
  function init(){
    if(!STORAGE_OK){var wb=document.getElementById("warnbar");if(wb)wb.hidden=false;}
    renderApps();
    var mb=document.getElementById("menuBtn");if(mb)mb.addEventListener("click",openDrawer);
    var dcl=document.getElementById("drawerClose");if(dcl)dcl.addEventListener("click",closeDrawer);
    var dbg=document.getElementById("drawerBg");if(dbg)dbg.addEventListener("click",closeDrawer);
    document.addEventListener("keydown",function(e){if(e.key==="Escape")closeDrawer();});
    document.querySelectorAll(".tab").forEach(function(t){t.addEventListener("click",function(){activateTab(t.getAttribute("data-view"));});});
    var dp=document.getElementById("dayPrev"),dn=document.getElementById("dayNext");
    if(dp)dp.addEventListener("click",function(){journalDate=isoOf(addDays(journalDate,-1));renderJournal();});
    if(dn)dn.addEventListener("click",function(){var c=isoOf(addDays(journalDate,1));if(c<=todayStr()){journalDate=c;renderJournal();}});
    var be=document.getElementById("btnExport");if(be)be.addEventListener("click",exportData);
    var fi=document.getElementById("fileImport");if(fi)fi.addEventListener("change",function(){if(this.files&&this.files[0])importData(this.files[0]);this.value="";});
    var br=document.getElementById("btnReset");if(br)br.addEventListener("click",function(){if(confirm("Tout effacer ? Action irréversible (pense à exporter avant).")){state={sessions:{},days:{},tri:{}};save();currentSel=null;currentTri=null;activateTab("v-today");}});
    var bc=document.getElementById("bilanCopy");if(bc)bc.addEventListener("click",function(){
      var ta=document.getElementById("bilanText");var txt=ta.value;
      function ok(){bc.textContent="Bilan copié ✓";setTimeout(function(){bc.textContent="Copier le bilan";},1600);}
      function fb(){try{ta.focus();ta.select();document.execCommand("copy");ok();}catch(e){}}
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(ok,fb);}else{fb();}
    });
    activateTab("v-today");
  }
  init();

})();
