const $ = s => document.querySelector(s);
const uid = () => crypto.randomUUID().replaceAll('-','');
const clone = x => JSON.parse(JSON.stringify(x));
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const missing = x => !String(x??'').trim() || String(x).trim()==='*';
function number(s){let n=Number(String(s??'').trim().replace(',','.'));return String(s??'').trim()!==''&&Number.isFinite(n)?n:null}
// Parse calendar dates without timezone conversion or ambiguous US formats.
function calendarDate(value){
 const text=String(value??'').trim();let m=text.match(/^(\d{4})-(\d{2})-(\d{2})$/),y,month,day;
 if(m){[,y,month,day]=m}else{m=text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);if(!m)return null;[,day,month,y]=m}
 const d=new Date(0);d.setUTCHours(0,0,0,0);d.setUTCFullYear(+y,+month-1,+day);
 return d.getUTCFullYear()===+y&&d.getUTCMonth()===+month-1&&d.getUTCDate()===+day?`${y}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`:null;
}
function filterDescription(f){return f.operator==='in'?`tra le categorie: ${(f.values||[]).map(v=>missing(v)?'(mancante)':v).join(', ')}`:`${f.operator} ${f.value??''}${f.operator==='tra'?' e '+f.end:''}`}
const sampleRows=[['Riga','Macchina','Misura'],['1','M1','20.03'],['2','M1','19.98'],['3','M1','20.04'],['4','M2','20.02'],['5','M2','19.96'],['6','M1','20.01'],['7','M1','20.05'],['8','M2','19.99'],['9','M1','20.00'],['10','M2','20.03']];
function infer(name,rows,i){let vals=[...new Set(rows.map(r=>(r[i]??'').trim()).filter(x=>!missing(x)))];let kind='Nominal';if(vals.length&&vals.every(v=>number(v)!==null))kind='Numeric';else if(vals.length&&vals.every(v=>calendarDate(v)!==null))kind='Date';else if(vals.length>1){let scales=[['basso','medio','alto'],['bassa','media','alta'],['low','medium','high'],['scarso','sufficiente','buono','ottimo'],['insufficiente','sufficiente','buono','ottimo'],['molto insoddisfatto','insoddisfatto','neutro','soddisfatto','molto soddisfatto']];let scale=scales.find(s=>vals.every(v=>s.some(x=>x.toLowerCase()===v.toLowerCase())));if(scale)kind='Ordinal'}return {id:uid(),name,kind,automatic:true,levels:[]}}
function newSheet(name,headers,rows){return{id:uid(),name,columns:headers.map(h=>({id:uid(),name:h,kind:'Nominal',automatic:true,levels:[]})),rows:rows.map(r=>headers.map((_,i)=>String(r[i]??''))),filters:[],analyses:[],revision:1,selectedColumn:0,selectedAnalysis:0}}
let project={formatVersion:2,applicationVersion:'web-0.1',activeSheetId:'',joins:[],sheets:[]},dirty=false;
function init(){let s=newSheet('Foglio 1',sampleRows[0],sampleRows.slice(1));s.columns=s.columns.map((c,i)=>infer(c.name,s.rows,i));project.sheets=[s];project.activeSheetId=s.id;render();}
let sheet=()=>project.sheets.find(s=>s.id===project.activeSheetId)||project.sheets[0];
function classify(s){s.columns.forEach((c,i)=>{if(c.automatic){let x=infer(c.name,s.rows,i);c.kind=x.kind;c.levels=x.levels}})}
function visibleRows(s=sheet()){return s.rows.map((r,i)=>({r,i})).filter(({r})=>s.filters.every(f=>{let x=r[f.column]??'',v=f.value??'';if(f.operator==='in')return (f.values||[]).includes(x);let a=f.type==='Date'?calendarDate(x):number(x),b=f.type==='Date'?calendarDate(v):number(v);if(f.type==='Date'&&!['vuoto','non vuoto'].includes(f.operator)){if(a===null||b===null)return false;if(f.operator==='=')return a===b;if(f.operator==='≠')return a!==b;if(f.operator==='tra')return a>=b&&a<=f.end}switch(f.operator){case'vuoto':return missing(x);case'non vuoto':return!missing(x);case'contiene':return x.toLowerCase().includes(v.toLowerCase());case'=':return x.toLowerCase()===v.toLowerCase();case'≠':return x.toLowerCase()!==v.toLowerCase();case'>':return a!==null&&b!==null&&a>b;case'≥':return a!==null&&b!==null&&a>=b;case'<':return a!==null&&b!==null&&a<b;case'≤':return a!==null&&b!==null&&a<=b;default:return true}}))}
function fmt(x){if(x===null||x===undefined||Number.isNaN(x))return'Non definito';return new Intl.NumberFormat('it-IT',{maximumSignificantDigits:12}).format(x)}
let analysisTitleEditingProject=null;
function analysisWindowTitle(){
 const name=typeof project.analysisWindowTitle==='string'?project.analysisWindowTitle:'';
 return name.replace(/\s+/g,' ').trim().slice(0,120)||'Analisi';
}
function sizeAnalysisWindowTitle(){
 const input=$('#analysis-window-name');input.size=Math.max(7,Math.min(32,[...input.value].length+1));
}
function renderAnalysisWindowTitle(){
 const input=$('#analysis-window-name');
 if(document.activeElement!==input||analysisTitleEditingProject!==project)input.value=analysisWindowTitle();
 sizeAnalysisWindowTitle();
 $('.analysis-section').setAttribute('aria-label','Finestra analisi: '+analysisWindowTitle());
}
function commitAnalysisWindowTitle(){
 const input=$('#analysis-window-name');
 if(analysisTitleEditingProject&&analysisTitleEditingProject!==project){renderAnalysisWindowTitle();return}
 const name=input.value.replace(/\s+/g,' ').trim().slice(0,120)||'Analisi',changed=name!==analysisWindowTitle();
 input.value=name;sizeAnalysisWindowTitle();
 if(changed){
  project.analysisWindowTitle=name;dirty=true;
  $('#dirty').textContent='Modifiche non esportate';$('#dirty').className='saved unsaved';
  localStorage.setItem('statistica-web-autosave',JSON.stringify(project));
 }
 $('.analysis-section').setAttribute('aria-label','Finestra analisi: '+name);
}
let analysisNavigationActive=null;
function renderAnalysisNavigation(){
 const list=$('#analysis-navigation');if(!list)return;
 const current=sheet(),active=analysisNavigationActive;
 const validActive=active?.project===project&&active.sheetId===current.id&&current.analyses.some(a=>a.id===active.analysisId);
 const activeId=validActive?active.analysisId:current.analyses[current.selectedAnalysis||0]?.id;
 const existing=new Map([...list.querySelectorAll('[data-open-analysis]')].map(button=>[JSON.stringify([button.dataset.analysisSheet,button.dataset.openAnalysis]),button]));
 const retained=new Set();let index=0;
 // Reuse keyed buttons so a title blur/save cannot replace a clicked navigation target.
 for(const owner of project.sheets)for(const analysis of owner.analyses){
  const key=JSON.stringify([owner.id,analysis.id]),name=AnalysisWindows.title(analysis);
  let button=existing.get(key);
  if(!button){
   button=document.createElement('button');button.type='button';button.className='analysis-nav-item';
   button.dataset.openAnalysis=analysis.id;button.dataset.analysisSheet=owner.id;
   const icon=document.createElement('span');icon.className='analysis-nav-icon';icon.textContent='▥';icon.setAttribute('aria-hidden','true');
   const text=document.createElement('span');text.className='analysis-nav-text';
   const title=document.createElement('span');title.className='analysis-nav-title';
   const context=document.createElement('small');context.className='analysis-nav-sheet';
   text.append(title,context);button.append(icon,text);
  }
  button.querySelector('.analysis-nav-title').textContent=name;
  button.querySelector('.analysis-nav-sheet').textContent=owner.name;
  button.title=name+' · '+owner.name;button.setAttribute('aria-label',button.title);
  const selected=owner.id===current.id&&analysis.id===activeId;
  button.classList.toggle('active',selected);
  if(selected)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');
  if(list.children[index]!==button)list.insertBefore(button,list.children[index]||null);
  retained.add(button);index++;
 }
 for(const child of [...list.children])if(!retained.has(child))child.remove();
 if(!index){const empty=document.createElement('div');empty.className='analysis-nav-empty';empty.textContent='Nessuna analisi creata';list.append(empty)}
}
function activateAnalysisNavigation(sheetId,analysisId){
 analysisNavigationActive={project,sheetId,analysisId};renderAnalysisNavigation();
}
function render(){if(!project.sheets.length)init();AnalysisWindows.capture();renderAnalysisWindowTitle();deduplicateSavedAnalyses();let s=sheet();classify(s);$('#project-name').textContent=project.name||'Progetto senza nome';$('#sheet-heading').textContent=s.name;$('#table-sheet-name').textContent='· '+s.name;$('#dirty').textContent=dirty?'Modifiche non esportate':'Salvato nel browser';$('#dirty').className=dirty?'saved unsaved':'saved';$('#data-summary').textContent=`${s.rows.length.toLocaleString('it-IT')} righe · ${s.columns.length} colonne · ${s.filters.length} filtri`;
 $('#sheet-list').innerHTML=project.sheets.map(x=>`<button class="sheet-item ${x.id===s.id?'active':''}" data-sheet="${x.id}"><span class="sheet-glyph">▦</span>${esc(x.name)}</button>`).join('');
 $('#filter-column').innerHTML=s.columns.map((c,i)=>`<option value="${i}">${esc(c.name)}</option>`).join('');$('#analysis-column').innerHTML=s.columns.map((c,i)=>`<option value="${i}">${esc(c.name)}</option>`).join('');$('#analysis-column').value=Math.min(s.selectedColumn||0,s.columns.length-1);
 let vis=visibleRows(s);$('#visible-count').textContent=`${vis.length} di ${s.rows.length}`;
 $('#data-table').innerHTML='<thead><tr><th>#</th>'+s.columns.map((c,i)=>`<th title="${esc(c.kind)}" data-col="${i}">${esc(c.name)} <span class="column-kind">${c.kind==='Numeric'?'123':c.kind==='Ordinal'?'↕':c.kind==='Date'?'▦':'Aa'}</span>${s.filters.some(f=>f.column===i)?'<span class="column-filter-icon" title="Filtro attivo" aria-label="Filtro attivo"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 2h14L10 8v5l-4 2V8z"/></svg></span>':''}</th>`).join('')+'</tr></thead><tbody>'+vis.map(({r,i})=>`<tr data-row="${i}"><td>${i+1}</td>${r.map((v,j)=>`<td><input aria-label="Riga ${i+1}, ${esc(s.columns[j].name)}" data-row="${i}" data-col="${j}" value="${esc(v)}"></td>`).join('')}</tr>`).join('')+'</tbody>';
 $('#analysis-list').innerHTML=s.analyses.map((a,i)=>analysisHtml(a,i,s)).join('');$('#empty-analysis').classList.toggle('hidden',s.analyses.length>0);
 $('#clear-filters').disabled=s.filters.length===0;$('#clear-filters').style.opacity=s.filters.length===0?'.5':'1';
 $('#active-filters').innerHTML=s.filters.map((f,i)=>`<div class="active-filter"><span>${esc(s.columns[f.column]?.name)} ${esc(filterDescription(f))}</span><button data-remove-filter="${i}" aria-label="Rimuovi filtro ${i+1}" title="Rimuovi questo filtro">×</button></div>`).join('');
 $('#active-filters').hidden=!s.filters.length;
 renderFilterEditor('filter',s,+$('#filter-column').value);
 setupColumnResize();
 AnalysisWindows.restore();
 renderAnalysisNavigation();
}
function setupColumnResize(){
 let saved={};
 try{saved=JSON.parse(localStorage.getItem('statistica-column-widths')||'{}')}catch{}
 document.querySelectorAll('#data-table,.group-table table').forEach(table=>{
  const headers=[...table.querySelectorAll('thead th')];
  const analysis=table.closest('.analysis-card');
  const index=analysis?[...analysis.parentNode.children].indexOf(analysis):-1;
  const key=sheet().id+':'+(index<0?'data':sheet().analyses[index].id);
  const keys=headers.map((th,i)=>index<0?(i===0?'row':sheet().columns[i-1].id):th.textContent);
  const widths=headers.map((th,i)=>Math.max(46,saved[key]?.[keys[i]]||Math.ceil(th.getBoundingClientRect().width)));
  const cols=document.createElement('colgroup');
  widths.forEach(width=>{const col=document.createElement('col');col.style.width=width+'px';cols.append(col)});
  table.prepend(cols);
  table.classList.add('resizable-table');
  const apply=()=>{table.style.width=widths.reduce((sum,w)=>sum+w,0)+'px';[...cols.children].forEach((col,i)=>col.style.width=widths[i]+'px')};
  apply();
  headers.forEach((th,i)=>{
   const handle=document.createElement('span');
   handle.className='column-resizer';handle.title='Trascina per modificare la larghezza';
   handle.addEventListener('dblclick',e=>e.stopPropagation());
   handle.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    const start=e.clientX,width=widths[i];
    handle.setPointerCapture(e.pointerId);
    document.body.classList.add('resizing-columns');
    const move=event=>{widths[i]=Math.max(46,Math.round(width+event.clientX-start));apply()};
    const finish=()=>{
     handle.removeEventListener('pointermove',move);
     handle.removeEventListener('pointerup',finish);
     handle.removeEventListener('pointercancel',finish);
     document.body.classList.remove('resizing-columns');
     saved[key]=Object.fromEntries(keys.map((k,j)=>[k,widths[j]]));
     localStorage.setItem('statistica-column-widths',JSON.stringify(saved));
     localStorage.setItem('statistica-web-autosave',JSON.stringify(project));
    };
    handle.addEventListener('pointermove',move);
    handle.addEventListener('pointerup',finish);
    handle.addEventListener('pointercancel',finish);
   });
   th.append(handle);
  });
 });
}

function stats(xs,miss=0){if(!xs.length)throw Error('Nessun dato numerico valido nella selezione.');let sorted=[...xs].sort((a,b)=>a-b),mean=xs.reduce((a,b)=>a+b,0)/xs.length,ss=xs.reduce((a,v)=>a+(v-mean)**2,0),n=xs.length;return{'N validi':n,'N mancanti':miss,'N totale':n+miss,'Media':mean,'Mediana':n%2?sorted[n>>1]:sorted[n/2-1]/2+sorted[n/2]/2,'Deviazione standard campionaria':n>1?Math.sqrt(ss/(n-1)):NaN,'Varianza campionaria':n>1?ss/(n-1):NaN,'Errore standard della media':n>1?Math.sqrt(ss/(n-1))/Math.sqrt(n):NaN,'Minimo':sorted[0],'Massimo':sorted[n-1],'Ampiezza':sorted[n-1]-sorted[0],'Somma':xs.reduce((a,b)=>a+b,0)}}
function valuesFor(s,col,selected){let xs=[],miss=0,obs=[];for(let i of selected){let v=s.rows[i][col],n=number(v);if(missing(v)){miss++;continue}if(n===null)throw Error(`Colonna ${s.columns[col].name}, riga ${i+1}: valore non numerico.`);xs.push(n);obs.push({row:i+1,value:n})}return{xs,miss,obs}}
function calc(s,kind,col,group=-1){let selected=visibleRows(s).map(x=>x.i),{xs,miss,obs}=valuesFor(s,col,selected);if(!xs.length)throw Error('Nessun dato numerico valido nella selezione.');let metrics,groups=null;if(kind==='I-MR'){let mrs=[];for(let i=1;i<obs.length;i++)if(obs[i].row===obs[i-1].row+1)mrs.push(Math.abs(obs[i].value-obs[i-1].value));if(!mrs.length)throw Error('SPC: servono almeno due misure su righe originali consecutive.');metrics=stats(xs,miss);let mr=mrs.reduce((a,b)=>a+b,0)/mrs.length,sigma=mr/1.128,mean=metrics.Media;Object.assign(metrics,{'Coppie MR valide':mrs.length,'MR medio':mr,'Sigma entro (MR / 1,128)':sigma,'LCL I':mean-3*sigma,'CL I':mean,'UCL I':mean+3*sigma,'LCL MR':Math.max(0,mr-3*.8525*sigma),'CL MR':mr,'UCL MR':mr+3*.8525*sigma,'Punti I oltre i limiti':obs.filter(o=>o.value<mean-3*sigma||o.value>mean+3*sigma).length})}else{metrics=stats(xs,miss);if(group>=0){let c=s.columns[group],map=new Map();for(let i of selected){let key=missing(s.rows[i][group])?null:s.rows[i][group].trim();if(!map.has(key))map.set(key,[]);map.get(key).push(i)}groups=[...map.entries()].sort(([a],[b])=>a===null?1:b===null?-1:c.kind==='Ordinal'?c.levels.indexOf(a)-c.levels.indexOf(b):String(a).localeCompare(String(b),'it'));groups=groups.map(([category,rows])=>{let v=valuesFor(s,col,rows);return{category:category??'(mancante)',categoryMissing:category===null,snapshot:v.obs,metrics:v.xs.length?stats(v.xs,v.miss):{'N validi':0,'N mancanti':v.miss,'N totale':v.miss,'Media':NaN,'Mediana':NaN,'Deviazione standard campionaria':NaN,'Varianza campionaria':NaN,'Errore standard della media':NaN,'Minimo':NaN,'Massimo':NaN,'Ampiezza':NaN,'Somma':NaN}}})}}
 let filter=s.filters.map(f=>`${s.columns[f.column].name} ${filterDescription(f)}`).join(' AND ')||'Tutte le righe';return{id:uid(),kind,columnId:s.columns[col].id,columnName:s.columns[col].name,groupColumnId:group>=0?s.columns[group].id:null,groupColumnName:group>=0?s.columns[group].name:null,groups,snapshot:obs,metrics,filter,revision:s.revision,createdAt:new Date().toISOString()}}
function analysisHtml(a,i,s){let stale=a.revision!==s.revision,metrics=Object.entries(a.metrics),visible=['N validi','N mancanti','Media','Mediana','Deviazione standard campionaria','Varianza campionaria','Errore standard della media','Minimo','Massimo','Ampiezza','Somma','MR medio','Sigma entro (MR / 1,128)','LCL I','CL I','UCL I','LCL MR','CL MR','UCL MR','Punti I oltre i limiti'];metrics=metrics.filter(([k])=>visible.includes(k));let group=a.groups?.length?`<div class="group-results"><p class="group-heading">Statistiche per categoria · ${esc(a.groupColumnName)}</p><div class="group-table"><table><thead><tr><th>Categoria</th>${['N validi','N mancanti','Media','Mediana','Deviazione standard campionaria','Varianza campionaria','Errore standard della media','Minimo','Massimo','Ampiezza','Somma'].map(k=>`<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${a.groups.map(g=>`<tr><td>${esc(g.category)}</td>${['N validi','N mancanti','Media','Mediana','Deviazione standard campionaria','Varianza campionaria','Errore standard della media','Minimo','Massimo','Ampiezza','Somma'].map(k=>`<td>${fmt(g.metrics[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${a.kind==='Descrittiva'?`<div class="group-plot-controls-host">${AnalysisPlots.groupControlsHtml(a,i)}</div><div class="group-analysis-plots" aria-live="polite">${AnalysisPlots.groupChartsHtml(a)}</div>`:''}</div>`:'';return`<article class="analysis-card analysis-result-window" data-analysis-id="${esc(a.id)}" data-sheet-id="${esc(s.id)}" data-analysis-index="${i}" data-window-mode="normal" aria-label="${esc(AnalysisWindows.title(a))}"><div class="analysis-card-head"><div class="analysis-result-window-heading"><input class="analysis-result-title" type="text" maxlength="120" data-analysis-title="${i}" value="${esc(AnalysisWindows.title(a))}" aria-label="Nome della finestra ${esc(a.columnName)}" title="Scrivi il nome · Invio per confermare · Esc per annullare" autocomplete="off"><div class="analysis-name"><span class="analysis-badge">${a.kind==='I-MR'?'SPC':'DESCRITTIVA'}</span>${esc(a.columnName)}${a.groupColumnName?` · per ${esc(a.groupColumnName)}`:''}${stale?`<button class="analysis-badge" style="color:#b06c00;background:#fff7e7" data-refresh-analysis="${i}" title="Ricalcola con i dati e i filtri attuali">DA AGGIORNARE · Ricalcola</button>`:''}</div><div class="analysis-meta">${esc(a.filter)} · ${a.snapshot.length} valori validi · ${new Date(a.createdAt||Date.now()).toLocaleString('it-IT')}</div></div><div class="analysis-result-window-controls"><button data-analysis-window-action="minimize" data-analysis-index="${i}" title="Riduci questa analisi" aria-label="Riduci questa analisi" aria-expanded="true">—</button><button data-analysis-window-action="maximize" data-analysis-index="${i}" title="Ingrandisci questa analisi" aria-label="Ingrandisci questa analisi" aria-pressed="false">□</button><button class="quiet small" data-remove-analysis="${i}">Rimuovi</button></div></div><div class="analysis-result-content"><div class="analysis-card-body${group?' has-groups':''}"><div class="general-analysis"><div class="metrics">${metrics.map(([k,v])=>`<div class="metric"><div class="metric-label">${esc(k)}</div><div class="metric-value">${fmt(v)}</div></div>`).join('')}</div>${a.kind==='Descrittiva'?AnalysisPlots.controlsHtml(a,i):''}<div class="analysis-plots" aria-live="polite">${a.kind==='Descrittiva'?AnalysisPlots.chartsHtml(a):''}</div></div>${group}</div><div class="analysis-footer"><span>${a.kind==='I-MR'?'Carta I-MR sperimentale · MR su righe consecutive':'Deviazione standard campionaria (n−1)'} · riga di origine conservata</span><button data-report="${i}">Esporta report</button></div></div></article>`}
function chartSvg(a){let obs=a.snapshot||[];if(!obs.length)return'';let vals=obs.map(o=>o.value),min=Math.min(...vals),max=Math.max(...vals),pad=(max-min||1)*.18,ymin=min-pad,ymax=max+pad,w=460,h=190,L=42,R=12,T=13,B=28;let x=i=>L+i*Math.max(1,(w-L-R)/(obs.length-1||1)),y=v=>T+(ymax-v)/(ymax-ymin)*(h-T-B);let points=obs.map((o,i)=>`${x(i)},${y(o.value)}`).join(' ');let lines=a.kind==='I-MR'?['LCL I','CL I','UCL I'].map((k,i)=>{let val=a.metrics[k],col=i===1?'#25a374':'#db6f6f';return`<line x1="${L}" x2="${w-R}" y1="${y(val)}" y2="${y(val)}" stroke="${col}" stroke-dasharray="4 4"/><text x="${w-R-2}" y="${y(val)-3}" text-anchor="end" font-size="8" fill="${col}">${k} ${esc(fmt(val))}</text>`}).join(''):'';return`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Grafico valori analizzati"><line x1="${L}" x2="${L}" y1="${T}" y2="${h-B}" stroke="#dbe2e9"/><line x1="${L}" x2="${w-R}" y1="${h-B}" y2="${h-B}" stroke="#dbe2e9"/><text x="6" y="${T+7}" font-size="8" fill="#91a0b0">${esc(fmt(ymax))}</text><text x="6" y="${h-B}" font-size="8" fill="#91a0b0">${esc(fmt(ymin))}</text>${lines}<polyline points="${points}" fill="none" stroke="#4b8ee8" stroke-width="1.2" opacity=".5"/>${obs.map((o,i)=>`<circle cx="${x(i)}" cy="${y(o.value)}" r="3" fill="#1769e0"><title>Riga ${o.row}: ${fmt(o.value)}</title></circle>`).join('')}<text x="${w/2}" y="${h-5}" text-anchor="middle" font-size="8" fill="#8793a2">Riga originale</text><text x="${L+5}" y="12" font-size="8" fill="#8793a2">${esc(a.columnName)}</text></svg>`}
function touch(s=sheet()){s.revision++;dirty=true;$('#dirty').textContent='Modifiche non esportate';$('#dirty').className='saved unsaved';localStorage.setItem('statistica-web-autosave',JSON.stringify(project));render()}
function modal(title,body,buttons=[['Annulla','cancel','quiet'],['Conferma','ok','primary']]){return new Promise(resolve=>{let d=$('#modal');$('#modal-content').innerHTML=`<div class="modal-box"><h3>${title}</h3>${body}<div class="modal-buttons">${buttons.map(([t,v,c])=>`<button class="${c}" value="${v}">${t}</button>`).join('')}</div></div>`;d.showModal();d.addEventListener('close',function f(){d.removeEventListener('close',f);resolve(d.returnValue)},{once:true})})}
function csvParse(text,sep){let out=[],row=[],field='',q=false;for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){field+='"';i++}else q=!q}else if(!q&&c===sep){row.push(field);field=''}else if(!q&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);field='';out.push(row);row=[]}else field+=c}if(q)throw Error('Virgolette non chiuse nel file.');if(field||row.length){row.push(field);out.push(row)}return out}
function detectSep(t){let first=t.split(/\r?\n/)[0];return [';',',','\t'].sort((a,b)=>first.split(b).length-first.split(a).length)[0]}
function addImported(data,name){if(data.length<2||!data[0].length)throw Error('Il file deve avere intestazioni e almeno una riga.');let headers=data[0].map(x=>x.trim());if(headers.some(x=>!x)||new Set(headers.map(x=>x.toLowerCase())).size!==headers.length)throw Error('Le intestazioni devono essere non vuote e univoche.');let s=newSheet(name||'Importazione',headers,data.slice(1).filter(r=>r.some(x=>x!=='')));s.columns=s.columns.map((c,i)=>infer(c.name,s.rows,i));project.sheets.push(s);project.activeSheetId=s.id;dirty=true;render();touch(s)}
function txt(el){return el?.textContent||''}function descendants(node,name){return [...node.getElementsByTagName('*')].filter(x=>x.localName===name)}function first(node,name){return descendants(node,name)[0]}
function readLegacyXml(text){let doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('File XML progetto non valido.');let root=doc.documentElement;if(root.localName!=='ProjectData')throw Error('Formato progetto non riconosciuto.');let p={formatVersion:Number(txt(first(root,'FormatVersion')))||1,applicationVersion:txt(first(root,'ApplicationVersion')),activeSheetId:txt(first(root,'ActiveSheetId')),joins:[],sheets:[]};let sheetsNode=first(root,'Sheets');for(let sn of [...sheetsNode.children].filter(x=>x.localName==='SheetData')){let colsNode=[...sn.children].find(x=>x.localName==='Columns'),columns=[];for(let cn of [...colsNode.children].filter(x=>x.localName==='ColumnData'))columns.push({id:txt(first(cn,'Id')),name:txt(first(cn,'Name')),kind:txt(first(cn,'Kind'))||'Nominal',automatic:txt(first(cn,'Automatic'))!=='false',levels:descendants(cn,'string').map(txt)});let rowsNode=[...sn.children].find(x=>x.localName==='Rows'),rows=[...rowsNode.children].filter(x=>x.localName==='ArrayOfstring').map(r=>[...r.children].filter(x=>x.localName==='string').map(txt));let filtersNode=[...sn.children].find(x=>x.localName==='Filters'),filters=[...filtersNode.children].filter(x=>x.localName==='FilterRule').map(f=>({column:Number(txt(first(f,'Column'))),operator:txt(first(f,'Operator')),value:txt(first(f,'Value'))}));let analysesNode=[...sn.children].find(x=>x.localName==='Analyses'),analyses=[...analysesNode.children].filter(x=>x.localName==='AnalysisData').map(a=>{let columnId=txt(first(a,'ColumnId')),col=columns.find(x=>x.id===columnId);let metrics={};for(let pair of descendants(a,'KeyValueOfstringdouble')){let k=txt(first(pair,'Key')),v=Number(txt(first(pair,'Value')));metrics[k]=v}let snapshot=descendants(first(a,'Snapshot')||a,'Observation').map(o=>({row:Number(txt(first(o,'Row'))),value:Number(txt(first(o,'Value')))}));let groupsNode=first(a,'Groups'),groups=groupsNode&&groupsNode.getAttributeNS('http://www.w3.org/2001/XMLSchema-instance','nil')!=='true'?[...groupsNode.children].filter(x=>x.localName==='GroupResult').map(g=>{let gm={};for(let pair of descendants(g,'KeyValueOfstringdouble'))gm[txt(first(pair,'Key'))]=Number(txt(first(pair,'Value')));return{category:txt(first(g,'Category')),categoryMissing:txt(first(g,'CategoryMissing'))==='true',snapshot:descendants(first(g,'Snapshot')||g,'Observation').map(o=>({row:Number(txt(first(o,'Row'))),value:Number(txt(first(o,'Value')))})),metrics:gm}}):null;return{id:txt(first(a,'Id')),kind:txt(first(a,'Kind')),columnId,columnName:col?.name||'Variabile',groupColumnId:txt(first(a,'GroupColumnId'))||null,groupColumnName:txt(first(a,'GroupColumnName'))||null,groups,snapshot,metrics,filter:txt(first(a,'Filter')),revision:Number(txt(first(a,'Revision'))),createdAt:new Date().toISOString()}});p.sheets.push({id:txt(first(sn,'Id')),name:txt(first(sn,'Name')),columns,rows,filters,analyses,revision:Number(txt(first(sn,'Revision'))),selectedColumn:Number(txt(first(sn,'SelectedColumn'))),selectedAnalysis:Number(txt(first(sn,'SelectedAnalysis')))});}
 let joinsNode=first(root,'Joins');if(joinsNode)p.joins=[...joinsNode.children].filter(x=>x.localName==='JoinDefinition').map(j=>({id:txt(first(j,'Id')),name:txt(first(j,'Name')),leftSheetId:txt(first(j,'LeftSheetId')),rightSheetId:txt(first(j,'RightSheetId')),type:txt(first(j,'Type')),keys:descendants(first(j,'Keys')||j,'JoinKey').map(k=>({leftColumnId:txt(first(k,'LeftColumnId')),rightColumnId:txt(first(k,'RightColumnId'))}))}));if(p.formatVersion===1){p.sheets.forEach(s=>s.columns.forEach((c,i)=>{let q=infer(c.name,s.rows,i);c.kind=q.kind;c.automatic=true;c.levels=q.levels}));p.formatVersion=2}return p}
function validateProject(p){if(!p||!p.sheets?.length)throw Error('Il progetto non contiene fogli validi.');for(let s of p.sheets){if(!s.columns?.length||s.rows?.some(r=>r.length!==s.columns.length))throw Error(`Dati non validi nel foglio ${s.name||''}.`);s.filters=s.filters||[];s.analyses=s.analyses||[];s.columns.forEach(c=>{c.automatic??=true;c.levels??=[]});for(let a of s.analyses){a.columnName=s.columns.find(c=>c.id===a.columnId)?.name||a.columnName||'Variabile';a.createdAt??=new Date().toISOString()}}p.activeSheetId=p.sheets.some(s=>s.id===p.activeSheetId)?p.activeSheetId:p.sheets[0].id;p.joins??=[];return p}
async function openProjectFile(file){let text=await file.text();let p;try{p=text.trimStart().startsWith('<')?readLegacyXml(text):JSON.parse(text)}catch(e){throw Error('Non riesco a leggere il progetto: '+e.message)}project=validateProject(p);project.name=file.name.replace(/\.(statweb\.json|statproj|json|statweb)$/i,'');dirty=false;localStorage.setItem('statistica-web-autosave',JSON.stringify(project));render()}
function download(content,name,type){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
let projectExportPending=false;
function projectFileName(name){
 let base=String(name||'').trim().replace(/\.statweb\.json$/i,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'');
 return (base||'Progetto statistico')+'.statweb.json';
}
async function saveProject(){
 commitAnalysisWindowTitle();
 AnalysisWindows.commitTitle();
 if(projectExportPending)return;
 projectExportPending=true;
 const original=project,originalJson=JSON.stringify(project),data=clone(project);
 try{
  let filename=projectFileName(data.name||'Progetto statistico'),handle;
  if(typeof window.showSaveFilePicker==='function'){
   // Open directly from the click/keyboard gesture; do not await another dialog first.
   handle=await window.showSaveFilePicker({suggestedName:filename,types:[{description:'Progetto StatisticaWeb',accept:{'application/json':['.statweb.json']}}]});
   filename=handle.name;
  }else{
   const pending=modal('Esporta progetto',`<label for="export-project-name">Nome del progetto</label><input id="export-project-name" value="${esc(filename.replace(/\.statweb\.json$/i,''))}"><p>Il file avrà estensione .statweb.json. In questo browser la cartella dipende dalle impostazioni dei download: attiva “Chiedi dove salvare ogni file” per sceglierla a ogni esportazione.</p>`,[['Annulla','cancel','quiet'],['Esporta','ok','primary']]);
   $('#export-project-name').focus();
   if(await pending!=='ok')return;
   filename=projectFileName($('#export-project-name').value);
  }
  data.name=filename.replace(/\.statweb\.json$/i,'');data.applicationVersion='web-0.1';
  const content=JSON.stringify(data,null,2);
  if(handle){const writable=await handle.createWritable();try{await writable.write(content);await writable.close()}catch(error){try{await writable.abort()}catch{}throw error}}
  else download(content,filename,'application/json');
  // Mark only the exact exported revision; preserve edits/new projects made while saving.
  if(project===original&&JSON.stringify(project)===originalJson){project.name=data.name;dirty=false;localStorage.setItem('statistica-web-autosave',JSON.stringify(project));render()}
 }catch(error){if(error.name!=='AbortError')alert('Esportazione non riuscita: '+error.message)}
 finally{projectExportPending=false}
}

function exportCsv(filtered=false){let s=sheet(),rows=filtered?visibleRows(s).map(x=>x.r):s.rows,escCsv=x=>'"'+String(x??'').replaceAll('"','""')+'"',csv=[s.columns.map(c=>escCsv(c.name)).join(';'),...rows.map(r=>r.map(escCsv).join(';'))].join('\r\n');download('\ufeff'+csv,`${s.name}${filtered?'-filtrati':''}.csv`,'text/csv;charset=utf-8')}
async function runAnalysis(kind){
 let s=sheet(),col=Number($('#analysis-column').value);
 if(kind==='Descrittiva'){
  let numeric=s.columns.map((c,i)=>({c,i})).filter(x=>x.c.kind==='Numeric');
  if(!numeric.length){alert('Nessuna colonna numerica disponibile. Controlla i dati e il tipo delle colonne.');return}
  if(!numeric.some(x=>x.i===col))col=numeric[0].i;
  let choices=s.columns.map((c,i)=>({c,i})).filter(x=>x.c.kind!=='Numeric');
  let body=`<p>Scegli la colonna numerica da analizzare e, se desideri, una colonna categorica per suddividere i risultati.</p><label for="descriptive-column">Colonna da analizzare</label><select id="descriptive-column">${numeric.map(x=>`<option value="${x.i}"${x.i===col?' selected':''}>${esc(x.c.name)}</option>`).join('')}</select><label for="group-select">Raggruppa per (facoltativo)</label><select id="group-select"><option value="-1">Nessun raggruppamento</option>${choices.map(x=>`<option value="${x.i}">${esc(x.c.name)} · ${x.c.kind==='Ordinal'?'ordinale':'nominale'}</option>`).join('')}</select>`;
  let ans=await modal('Statistica descrittiva',body,[['Annulla','cancel','quiet'],['Calcola','ok','primary']]);
  if(ans!=='ok')return;
  col=Number($('#descriptive-column').value);
  s.selectedColumn=col;
  computeAdd(s,kind,col,Number($('#group-select').value));
  return;
 }
 s.selectedColumn=col;
 computeAdd(s,kind,col,-1);
}
function analysisResultKey(a){
 const {id,createdAt,revision,plotOptions,windowOptions,...result}=a;
 return JSON.stringify(result,function(key,value){return value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value});
}
function deduplicateSavedAnalyses(){
 let changed=false;
 for(const s of project.sheets){
  const seen=new Map(),selected=s.analyses[s.selectedAnalysis];
  s.analyses=s.analyses.filter(a=>{
   const key=analysisResultKey(a);
   if(seen.has(key)){changed=true;return false}
   seen.set(key,a);return true;
  });
  s.selectedAnalysis=selected?Math.max(0,s.analyses.indexOf(seen.get(analysisResultKey(selected)))):0;
 }
 if(changed)localStorage.setItem('statistica-web-autosave',JSON.stringify(project));
}
function refreshAnalysis(index){
 const s=sheet(),a=s.analyses[index];
 if(!a)return;
 const col=s.columns.findIndex(c=>c.id===a.columnId);
 const group=a.groupColumnId?s.columns.findIndex(c=>c.id===a.groupColumnId):-1;
 if(col<0||(a.groupColumnId&&group<0)){alert('Una colonna di questa analisi non è più disponibile.');return}
 try{
  const updated=calc(s,a.kind,col,group);
  updated.id=a.id;
  if(a.plotOptions)updated.plotOptions={...a.plotOptions};
  if(a.windowOptions)updated.windowOptions={...a.windowOptions};
  s.analyses[index]=updated;
  s.selectedAnalysis=index;
  dirty=true;
  localStorage.setItem('statistica-web-autosave',JSON.stringify(project));
  render();
 }catch(e){alert(e.message)}
}
function computeAdd(s,kind,col,group){
 try{
  const result=calc(s,kind,col,group),key=analysisResultKey(result);
  const existing=s.analyses.find(a=>analysisResultKey(a)===key);
  if(existing){
   result.id=existing.id;
   if(existing.plotOptions)result.plotOptions={...existing.plotOptions};
   if(existing.windowOptions)result.windowOptions={...existing.windowOptions};
   result.createdAt=existing.createdAt;
   s.analyses=s.analyses.filter(a=>a===existing||analysisResultKey(a)!==key);
   s.selectedAnalysis=s.analyses.indexOf(existing);
   s.analyses[s.selectedAnalysis]=result;
  }else{
   s.analyses.push(result);
   s.selectedAnalysis=s.analyses.length-1;
  }
  dirty=true;
  localStorage.setItem('statistica-web-autosave',JSON.stringify(project));
  render();
  AnalysisWindows.reveal(result.id);
 }catch(e){alert(e.message)}
}
function renderFilterEditor(prefix,s,col){
 const c=s.columns[col],host=$('#'+prefix+'-editor');if(!c||!host)return;
 if(c.kind==='Nominal'||c.kind==='Ordinal'){
  let vals=[...new Set(s.rows.map(r=>r[col]??''))];
  vals.sort((a,b)=>c.kind==='Ordinal'&&c.levels.includes(a)&&c.levels.includes(b)?c.levels.indexOf(a)-c.levels.indexOf(b):a.localeCompare(b,'it',{numeric:true}));
  host.innerHTML=`<fieldset class="filter-categories"><legend>Categorie da includere (scelta multipla)</legend><div class="filter-category-actions"><button type="button" data-all="true">Seleziona tutte</button><button type="button" data-all="false">Deseleziona tutte</button></div><div class="filter-category-list">${vals.map((v,i)=>`<label><input type="checkbox" data-category="${i}" checked><span>${esc(missing(v)?'(mancante)'+(v?' · '+v:''):v)}</span></label>`).join('')}</div></fieldset>`;
  host.categoryValues=vals;
  host.querySelectorAll('[data-all]').forEach(button=>button.onclick=()=>host.querySelectorAll('[data-category]').forEach(input=>input.checked=button.dataset.all==='true'));
  return;
 }
 const date=c.kind==='Date',ops=date?['=','≠','>','≥','<','≤','tra','vuoto','non vuoto']:['=','≠','contiene','>','≥','<','≤','vuoto','non vuoto'];
 host.innerHTML=`<label for="${prefix}-op">Condizione</label><select id="${prefix}-op">${ops.map(op=>`<option>${esc(op)}</option>`).join('')}</select><label for="${prefix}-value">${date?'Data':'Valore'}</label><input id="${prefix}-value" type="${date?'date':'text'}"><label for="${prefix}-end" hidden>Data finale (inclusa)</label><input id="${prefix}-end" type="date" hidden>`;
 const op=$('#'+prefix+'-op'),input=$('#'+prefix+'-value'),end=$('#'+prefix+'-end');
 op.onchange=()=>{input.disabled=['vuoto','non vuoto'].includes(op.value);end.hidden=op.value!=='tra';end.previousElementSibling.hidden=end.hidden};
}
function readFilterEditor(prefix,s,col){
 const c=s.columns[col],host=$('#'+prefix+'-editor');
 if(c.kind==='Nominal'||c.kind==='Ordinal'){
  const values=[...host.querySelectorAll('[data-category]:checked')].map(input=>host.categoryValues[+input.dataset.category]);
  if(!values.length)throw Error('Seleziona almeno una categoria.');
  return {column:col,operator:'in',values};
 }
 const operator=$('#'+prefix+'-op').value,value=$('#'+prefix+'-value').value;
 if(['vuoto','non vuoto'].includes(operator))return {column:col,operator,value:''};
 if(c.kind==='Date'){
  const end=$('#'+prefix+'-end').value;
  if(!calendarDate(value)||operator==='tra'&&(!calendarDate(end)||end<value))throw Error('Scegli date valide: la data finale deve essere uguale o successiva a quella iniziale.');
  return {column:col,operator,value,type:'Date',...(operator==='tra'?{end}:{})};
 }
 if(['>','≥','<','≤'].includes(operator)&&number(value)===null)throw Error('Inserisci una soglia numerica valida.');
 if(!value)throw Error('Inserisci il valore del filtro.');
 return {column:col,operator,value};
}
async function filterTableColumn(s,col){
 let pending=modal('Filtra colonna: '+esc(s.columns[col].name),'<p>Le categorie selezionate sono alternative; i filtri su colonne diverse si combinano in AND.</p><div id="column-filter-editor"></div>',[['Annulla','cancel','quiet'],['Applica filtro','ok','primary']]);
 renderFilterEditor('column-filter',s,col);
 // Validate before the dialog closes, preserving the selection on errors.
 const button=$('#modal button[value="ok"]');let rule;
 button.onclick=e=>{try{rule=readFilterEditor('column-filter',s,col)}catch(error){e.preventDefault();alert(error.message)}};
 if(await pending!=='ok')return;
 s.filters.push(rule);touch(s);
}

let tableClipboard='';
function insertTableColumn(s,index,name){
 s.columns.splice(index,0,{id:uid(),name,kind:'Nominal',automatic:true,levels:[]});
 s.rows.forEach(row=>row.splice(index,0,''));
 s.filters=s.filters.map(f=>({...f,column:f.column>=index?f.column+1:f.column}));
 if((s.selectedColumn||0)>=index)s.selectedColumn=(s.selectedColumn||0)+1;
}
async function newTableColumn(s,index){
 if(await modal('Inserisci colonna','<label for="context-column-name">Nome colonna</label><input id="context-column-name" placeholder="Nuova colonna">')!=='ok')return;
 const name=$('#context-column-name').value.trim();
 if(!name||s.columns.some(c=>c.name.toLowerCase()===name.toLowerCase())){alert('Scegli un nome non vuoto e univoco.');return}
 insertTableColumn(s,index,name);touch(s);
}
function clipboardText(rows){return rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join('\t')).join('\n')}
async function copyTableData(rows){
 tableClipboard=clipboardText(rows);
 try{await navigator.clipboard.writeText(tableClipboard)}catch{
  const pending=modal('Copia dati','<p>Copia il testo selezionato con Ctrl+C.</p><textarea id="clipboard-copy"></textarea>',[['Chiudi','ok','primary']]);
  $('#clipboard-copy').value=tableClipboard;$('#clipboard-copy').select();await pending;
 }
}
async function pasteTableData(s,row,col){
 let text;
 try{text=await navigator.clipboard.readText()}catch{}
 if(text===undefined){
  const pending=modal('Incolla dati','<p>Incolla qui con Ctrl+V i dati copiati da Excel o dalla tabella. I valori sostituiscono le celle a partire dalla posizione scelta.</p><textarea id="clipboard-paste"></textarea>');
  $('#clipboard-paste').value=tableClipboard;
  if(await pending!=='ok')return;
  text=$('#clipboard-paste').value;
 }
 if(!text)return;
 const rows=csvParse(text.replace(/\r?\n$/,''),'\t');
 if(!rows.length)return;
 const count=Math.max(...rows.map(r=>r.length));
 if(rows.length>10000||col+count>1000){alert('Troppi dati: massimo 10000 righe e 1000 colonne.');return}
 while(s.columns.length<col+count){
  let n=s.columns.length+1,name='C'+n;
  while(s.columns.some(c=>c.name===name))name='C'+(++n);
  insertTableColumn(s,s.columns.length,name);
 }
 while(s.rows.length<row+rows.length)s.rows.push(s.columns.map(()=>''));
 rows.forEach((values,i)=>values.forEach((value,j)=>s.rows[row+i][col+j]=value));
 classify(s);touch(s);
}
const tableMenu=document.createElement('div');
tableMenu.id='table-context-menu';tableMenu.className='table-context-menu';tableMenu.hidden=true;tableMenu.setAttribute('role','menu');document.body.append(tableMenu);
function closeTableMenu(){tableMenu.hidden=true;tableMenu.replaceChildren()}
document.addEventListener('pointerdown',e=>{if(!tableMenu.contains(e.target))closeTableMenu()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeTableMenu()});
window.addEventListener('resize',closeTableMenu);

$('#data-table').addEventListener('contextmenu',e=>{
 const cell=e.target.closest('th,td');if(!cell)return;
 e.preventDefault();closeTableMenu();
 const s=sheet(),input=cell.querySelector('input[data-row]');
 const col=cell.matches('th[data-col]')?+cell.dataset.col:input?+input.dataset.col:-1;
 const row=cell.closest('tr').dataset.row;
 const r=row===undefined?-1:+row;
 if(col<0&&r<0)return;
 const mode=r<0?'column':col<0?'row':'cell';
 const title=document.createElement('strong');title.textContent=mode==='column'?'Colonna: '+s.columns[col].name:mode==='row'?'Riga '+(r+1):'Cella: '+s.columns[col].name+' · riga '+(r+1);tableMenu.append(title);
 const add=(label,action)=>{
  const button=document.createElement('button');button.textContent=label;button.setAttribute('role','menuitem');
  button.onclick=async()=>{closeTableMenu();try{await action()}catch(err){alert(err.message)}};tableMenu.append(button);
 };
 if(mode==='column'){
  add('Filtra questa colonna',()=>filterTableColumn(s,col));
  if(s.filters.some(f=>f.column===col))add('Rimuovi filtri da questa colonna',()=>{s.filters=s.filters.filter(f=>f.column!==col);touch(s)});
 }
 const copyRows=()=>mode==='column'?s.rows.map(row=>[row[col]]):mode==='row'?[s.rows[r]]:[[s.rows[r][col]]];
 add(mode==='column'?'Copia colonna':mode==='row'?'Copia riga':'Copia cella',()=>copyTableData(copyRows()));
 add('Incolla qui',()=>pasteTableData(s,Math.max(0,r),Math.max(0,col)));
 add('Svuota contenuto',()=>{
  if(mode==='column')s.rows.forEach(row=>row[col]='');
  else if(mode==='row')s.rows[r]=s.columns.map(()=>'');
  else s.rows[r][col]='';
  classify(s);touch(s);
 });
 if(col>=0){
  add('Inserisci colonna a sinistra',()=>newTableColumn(s,col));
  add('Inserisci colonna a destra',()=>newTableColumn(s,col+1));
  add('Proprietà colonna',()=>editColumn(col));
  add('Elimina colonna',()=>deleteColumn(s,col));
 }
 if(r>=0){
  const insert=index=>{s.rows.splice(index,0,s.columns.map(()=>''));touch(s)};
  add('Inserisci riga sopra',()=>insert(r));add('Inserisci riga sotto',()=>insert(r+1));
  add('Elimina riga',async()=>{
   if(await modal('Elimina riga',`<p>Eliminare la riga ${r+1} e i suoi dati?</p>`,[['Annulla','cancel','quiet'],['Elimina','ok','primary']])!=='ok')return;
   s.rows.splice(r,1);classify(s);touch(s);
  });
 }
 tableMenu.hidden=false;
 tableMenu.style.left=Math.max(0,Math.min(e.clientX,window.innerWidth-tableMenu.offsetWidth-8))+'px';
 tableMenu.style.top=Math.max(0,Math.min(e.clientY,window.innerHeight-tableMenu.offsetHeight-8))+'px';
 tableMenu.querySelector('button')?.focus();
});
$('#active-filters').addEventListener('click',e=>{
 const button=e.target.closest('[data-remove-filter]');if(!button)return;
 sheet().filters.splice(+button.dataset.removeFilter,1);touch();
});

function getVal(node,name){return node.querySelector(`[data-${name}]`)}
$('#modal').addEventListener('keydown',e=>{
 if(e.key==='Enter'&&!e.isComposing&&e.target.matches('input:not([type="button"]):not([type="submit"])')){
  e.preventDefault();
  const confirm=$('#modal button[value="ok"]');
  if(confirm)confirm.click();
 }
});
$('#analysis-window-name').addEventListener('focus',e=>{analysisTitleEditingProject=project;e.target.select()});
$('#analysis-window-name').addEventListener('input',sizeAnalysisWindowTitle);
$('#analysis-window-name').addEventListener('blur',()=>{commitAnalysisWindowTitle();analysisTitleEditingProject=null});
$('#analysis-window-name').addEventListener('keydown',e=>{
 if(e.isComposing)return;
 if(e.key==='Enter'){e.preventDefault();commitAnalysisWindowTitle();e.target.blur()}
 if(e.key==='Escape'){e.preventDefault();e.target.value=analysisWindowTitle();e.target.blur()}
});
const workspaceWindows={
 table:{selector:'.data-card',header:'.card-toolbar',label:'tabella'},
 analysis:{selector:'.analysis-section',header:'.analysis-head',label:'analisi'}
};
function syncWindowBackdrop(){
 let maximized=false;
 for(const [key,settings] of Object.entries(workspaceWindows)){
  const active=$(settings.selector).dataset.windowMode==='maximized';
  document.body.classList.toggle(key+'-maximized',active);maximized||=active;
 }
 const resultMaximized=AnalysisWindows.hasMaximized();
 document.body.classList.toggle('analysis-card-maximized',resultMaximized);
 $('#table-window-backdrop').hidden=!(maximized||resultMaximized);
}
function setWorkspaceWindowMode(name,mode){
 const config=workspaceWindows[name];if(!config||!['normal','minimized','maximized'].includes(mode))return;
 if(mode==='maximized'||name==='analysis'&&mode==='minimized')AnalysisWindows.exitMaximized(false);
 const card=$(config.selector),previous=card.dataset.windowMode||'normal';
 // A single maximized window owns the shared backdrop and page scroll lock.
 if(mode==='maximized')for(const [other,settings] of Object.entries(workspaceWindows)){
  if(other!==name&&$(settings.selector).dataset.windowMode==='maximized')setWorkspaceWindowMode(other,'normal');
 }
 if(mode==='minimized'&&previous!=='minimized')card.dataset.restoreMode=previous;
 card.dataset.windowMode=mode;
 const minimize=$('#'+name+'-minimize'),maximize=$('#'+name+'-maximize');
 minimize.textContent=mode==='minimized'?'▣':'—';
 minimize.title=(mode==='minimized'?'Ripristina ':'Riduci ')+config.label;
 minimize.setAttribute('aria-label',minimize.title);
 minimize.setAttribute('aria-expanded',String(mode!=='minimized'));
 maximize.textContent=mode==='maximized'?'❐':'□';
 maximize.title=mode==='maximized'?'Ripristina dimensioni':'Ingrandisci '+config.label;
 maximize.setAttribute('aria-label',maximize.title);
 maximize.setAttribute('aria-pressed',String(mode==='maximized'));
 syncWindowBackdrop();
}
function setTableWindowMode(mode){setWorkspaceWindowMode('table',mode)}
function setAnalysisWindowMode(mode){setWorkspaceWindowMode('analysis',mode)}
for(const [name,config] of Object.entries(workspaceWindows)){
 const card=$(config.selector),toggleMaximize=()=>setWorkspaceWindowMode(name,card.dataset.windowMode==='maximized'?'normal':'maximized');
 $('#'+name+'-minimize').onclick=()=>setWorkspaceWindowMode(name,card.dataset.windowMode==='minimized'?(card.dataset.restoreMode||'normal'):'minimized');
 $('#'+name+'-maximize').onclick=toggleMaximize;
 card.querySelector(config.header).addEventListener('dblclick',e=>{
  if(e.target.closest('button,input,select,textarea,label,a,summary'))return;
  toggleMaximize();
 });
}
$('#table-add-column').onclick=()=>$('#add-column').click();
$('#table-add-rows').onclick=()=>$('#add-rows').click();

$('#analysis-navigation').addEventListener('click',e=>{
 const button=e.target.closest('[data-open-analysis]');if(!button)return;
 AnalysisWindows.commitTitle();
 const owner=project.sheets.find(s=>s.id===button.dataset.analysisSheet);
 if(!owner||!owner.analyses.some(a=>a.id===button.dataset.openAnalysis))return;
 if(project.activeSheetId!==owner.id){project.activeSheetId=owner.id;render()}
 AnalysisWindows.reveal(button.dataset.openAnalysis);
});
$('#sheet-list').addEventListener('click',e=>{let b=e.target.closest('[data-sheet]');if(b){project.activeSheetId=b.dataset.sheet;render()}});
$('#add-sheet').onclick=async()=>{let ans=await modal('Nuovo foglio','<label>Nome del foglio</label><input id="new-name" value="Foglio '+(project.sheets.length+1)+'">');if(ans!=='ok')return;let name=$('#new-name').value.trim();if(!name||project.sheets.some(x=>x.name.toLowerCase()===name.toLowerCase()))return alert('Scegli un nome univoco.');let s=newSheet(name,['C1','C2','C3'],Array.from({length:20},()=>['','','']));s.columns=s.columns.map(c=>({...c,kind:'Nominal'}));project.sheets.push(s);project.activeSheetId=s.id;touch(s)};
$('#rename-sheet').onclick=async()=>{let s=sheet(),ans=await modal('Rinomina foglio',`<label>Nome</label><input id="new-name" value="${esc(s.name)}">`);if(ans!=='ok')return;let name=$('#new-name').value.trim();if(!name||project.sheets.some(x=>x!==s&&x.name.toLowerCase()===name.toLowerCase()))return alert('Scegli un nome univoco.');s.name=name;touch(s)};
$('#add-column').onclick=async()=>{let s=sheet(),ans=await modal('Aggiungi colonna','<label>Nome colonna</label><input id="new-name" placeholder="Nuova colonna">');if(ans!=='ok')return;let name=$('#new-name').value.trim();if(!name||s.columns.some(c=>c.name.toLowerCase()===name.toLowerCase()))return alert('Nome vuoto o già utilizzato.');s.columns.push({id:uid(),name,kind:'Nominal',automatic:true,levels:[]});s.rows.forEach(r=>r.push(''));touch(s)};
$('#add-rows').onclick=async()=>{let ans=await modal('Aggiungi righe','<label>Numero di righe da aggiungere (1–10000)</label><input id="new-name" type="number" min="1" max="10000" value="10">');if(ans!=='ok')return;let n=Math.min(10000,Math.max(1,Number($('#new-name').value)||1)),s=sheet();for(let i=0;i<n;i++)s.rows.push(s.columns.map(()=>''));touch(s)};
$('#data-table').addEventListener('change',e=>{let x=e.target;if(x.matches('input[data-row]')){let s=sheet();s.rows[+x.dataset.row][+x.dataset.col]=x.value;classify(s);touch(s)}});
$('#data-table').addEventListener('dblclick',e=>{let h=e.target.closest('th[data-col]');if(h)editColumn(+h.dataset.col)});
async function deleteColumn(s,i){
 if(s.columns.length<=1){alert('Il foglio deve mantenere almeno una colonna.');return}
 const c=s.columns[i];
 const answer=await modal('Elimina colonna',`<p>Eliminare la colonna <strong>${esc(c.name)}</strong> e tutti i suoi dati?</p><p>Verranno eliminati anche i filtri, le analisi e i collegamenti che usano questa colonna.</p>`,[['Annulla','cancel','quiet'],['Elimina colonna','ok','primary']]);
 if(answer!=='ok')return;
 s.columns.splice(i,1);
 s.rows.forEach(row=>row.splice(i,1));
 s.filters=s.filters.filter(f=>f.column!==i).map(f=>({...f,column:f.column>i?f.column-1:f.column}));
 s.analyses=s.analyses.filter(a=>a.columnId!==c.id&&a.groupColumnId!==c.id);
 project.joins=project.joins.filter(j=>!(j.keys||[]).some(k=>(j.leftSheetId===s.id&&k.leftColumnId===c.id)||(j.rightSheetId===s.id&&k.rightColumnId===c.id)));
 s.selectedColumn=Math.min(Math.max(0,(s.selectedColumn||0)-((s.selectedColumn||0)>i?1:0)),s.columns.length-1);
 s.selectedAnalysis=Math.max(0,Math.min(s.selectedAnalysis||0,s.analyses.length-1));
 classify(s);touch(s);
}
async function editColumn(i){let s=sheet(),c=s.columns[i],levels=c.levels.join('\n'),body=`<label>Nome</label><input id="col-name" value="${esc(c.name)}"><label>Tipo</label><select id="col-kind"><option value="auto">Rileva automaticamente</option><option value="Numeric">Numerico</option><option value="Date">Data</option><option value="Nominal">Categorico nominale</option><option value="Ordinal">Categorico ordinale</option></select><label>Ordine categorie (una per riga, se ordinale)</label><textarea id="col-levels">${esc(levels)}</textarea>`;let ans=await modal('Proprietà colonna',body,[['Elimina colonna','delete','quiet'],['Annulla','cancel','quiet'],['Conferma','ok','primary']]);if(ans==='delete'){await deleteColumn(s,i);return}if(ans!=='ok')return;let name=$('#col-name').value.trim(),kind=$('#col-kind').value;if(!name||s.columns.some((x,j)=>j!==i&&x.name.toLowerCase()===name.toLowerCase()))return alert('Il nome deve essere univoco.');c.name=name;c.automatic=kind==='auto';if(!c.automatic){c.kind=kind;c.levels=kind==='Ordinal'?$('#col-levels').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean):[]}classify(s);touch(s)}
$('#filter-toggle').onclick=()=>$('#filter-panel').classList.toggle('hidden');
$('#filter-column').onchange=()=>renderFilterEditor('filter',sheet(),+$('#filter-column').value);
$('#apply-filter').onclick=()=>{try{let s=sheet();s.filters.push(readFilterEditor('filter',s,+$('#filter-column').value));touch(s)}catch(e){alert(e.message)}};
$('#clear-filters').onclick=()=>{let s=sheet();if(s.filters.length){s.filters=[];touch(s)}};
$('#run-descriptive').onclick=()=>runAnalysis('Descrittiva');$('#analysis-column').onchange=()=>{sheet().selectedColumn=+$('#analysis-column').value};
// Chart settings do not change the analysis revision or statistical identity.
function saveGroupPlotSettings(a,index,section,options,refreshControls=true){
 a.plotOptions={...a.plotOptions,groups:options};
 if(refreshControls){
 const host=section.querySelector('.group-plot-controls-host'),dropdown=host.querySelector('details');
 const open=!!dropdown?.open,scrollTop=host.querySelector('.group-cluster-list')?.scrollTop||0;
 const active=document.activeElement,focusKey=active?.dataset.groupKey,focusOption=active?.dataset.groupPlotOption,focusSelect=active?.dataset.groupSelect;
 host.innerHTML=AnalysisPlots.groupControlsHtml(a,index);
 const restored=host.querySelector('details');if(restored)restored.open=open;
 const focus=[...host.querySelectorAll('input,button')].find(el=>focusKey!==undefined?el.dataset.groupKey===focusKey:focusOption!==undefined?el.dataset.groupPlotOption===focusOption:focusSelect!==undefined&&el.dataset.groupSelect===focusSelect);
 if(focus)focus.focus({preventScroll:true});
 const list=host.querySelector('.group-cluster-list');if(list)list.scrollTop=scrollTop;
 }
 section.querySelector('.group-analysis-plots').innerHTML=AnalysisPlots.groupChartsHtml(a);
 dirty=true;$('#dirty').textContent='Modifiche non esportate';$('#dirty').className='saved unsaved';
 localStorage.setItem('statistica-web-autosave',JSON.stringify(project));
}
$('#analysis-list').addEventListener('input',e=>{
 const control=e.target.closest('[data-group-plot-option="confidence"]');if(!control)return;
 const index=+control.dataset.analysisIndex,a=sheet().analyses[index],section=control.closest('.group-results');if(!a||!section)return;
 const value=Number(control.value),valid=control.value!==''&&Number.isFinite(value)&&value>=50&&value<=99.9;
 control.setCustomValidity(valid?'':'Inserisci un livello di confidenza tra 50% e 99,9%.');
 control.setAttribute('aria-invalid',String(!valid));
 if(!valid)return;
 const options=AnalysisPlots.groupOptions(a);options.confidence=value;
 section.querySelectorAll('[data-group-plot-option="confidence"]').forEach(input=>{if(input!==control)input.value=value;input.setCustomValidity('');input.setAttribute('aria-invalid','false')});
 // Keep the number field and slider in place while typing or dragging.
 saveGroupPlotSettings(a,index,section,options,false);
});
$('#analysis-list').addEventListener('change',e=>{
 const control=e.target.closest('[data-group-plot-option],[data-group-key]');if(!control)return;
 const index=+control.dataset.analysisIndex,a=sheet().analyses[index],section=control.closest('.group-results');if(!a||!section)return;
 const options=AnalysisPlots.groupOptions(a),key=control.dataset.groupPlotOption;
 if(key){if(!['histogram','normality','overlay','ciMean','ciMedian','ciSd'].includes(key))return;options[key]=control.checked}
 else{
  const selected=new Set(options.selected===null?(a.groups||[]).map(AnalysisPlots.groupKey):options.selected);
  if(control.checked)selected.add(control.dataset.groupKey);else selected.delete(control.dataset.groupKey);
  options.selected=[...selected];
 }
 saveGroupPlotSettings(a,index,section,options);
});
$('#analysis-list').addEventListener('click',e=>{
 const button=e.target.closest('[data-group-select]');if(!button)return;
 const index=+button.dataset.analysisIndex,a=sheet().analyses[index],section=button.closest('.group-results');if(!a||!section)return;
 const options=AnalysisPlots.groupOptions(a);options.selected=button.dataset.groupSelect==='all'?null:[];
 saveGroupPlotSettings(a,index,section,options);
});
$('#analysis-list').addEventListener('input',e=>{
 const control=e.target.closest('[data-plot-option]');if(!control)return;
 const a=sheet().analyses[+control.dataset.analysisIndex];if(!a)return;
 const key=control.dataset.plotOption;
 if(!['histogram','normality','intervals','confidence','histogramBins'].includes(key))return;
 const options=AnalysisPlots.options(a);
 if(key==='confidence'){
  const value=Number(control.value);
  if(control.value===''||!Number.isFinite(value)||value<50||value>99.9)return;
  options.confidence=value;
 }else if(key==='histogramBins'){
  const value=Number(control.value),automatic=control.dataset.automatic==='true';
  delete control.dataset.automatic;
  if(!Number.isInteger(value)||value<1||value>200)return;
  options.histogramBins=automatic?null:value;
 }else options[key]=control.checked;
 a.plotOptions={...a.plotOptions,...options};
 const general=control.closest('.general-analysis');
 general.querySelector('.confidence-control').hidden=!options.intervals;
 general.querySelector('.histogram-controls').hidden=!options.histogram;
 const auto=AnalysisPlots.histogramDefaults(AnalysisPlots.sampleSummary(a.snapshot||[]));
 general.querySelector('.histogram-bin-mode').textContent=options.histogramBins===null?'Automatico: '+auto.method+(auto.capped?' · limite 40 bin':''):'Scelta manuale';
 const binsInput=general.querySelector('[data-plot-option="histogramBins"]');
 if(binsInput!==control)binsInput.value=options.histogramBins??(auto.count||1);
 general.querySelectorAll('[data-plot-option="confidence"]').forEach(input=>{if(input!==control)input.value=options.confidence});
 general.querySelector('.analysis-plots').innerHTML=AnalysisPlots.chartsHtml(a);
 dirty=true;
 $('#dirty').textContent='Modifiche non esportate';$('#dirty').className='saved unsaved';
 localStorage.setItem('statistica-web-autosave',JSON.stringify(project));
});
$('#analysis-list').addEventListener('click',e=>{const automatic=e.target.closest('[data-auto-bins]');if(automatic){const a=sheet().analyses[+automatic.dataset.autoBins];if(!a)return;const input=automatic.closest('.general-analysis').querySelector('[data-plot-option="histogramBins"]');input.value=AnalysisPlots.histogramDefaults(AnalysisPlots.sampleSummary(a.snapshot||[])).count||1;input.dataset.automatic='true';input.dispatchEvent(new Event('input',{bubbles:true}));return;}const refresh=e.target.closest('[data-refresh-analysis]');if(refresh){refreshAnalysis(+refresh.dataset.refreshAnalysis);return;}let rm=e.target.closest('[data-remove-analysis]'),rp=e.target.closest('[data-report]');if(rm){sheet().analyses.splice(+rm.dataset.removeAnalysis,1);touch()}if(rp){let a=sheet().analyses[+rp.dataset.report];download((a.revision!==sheet().revision?'ATTENZIONE: analisi riferita a una revisione precedente.\n\n':'')+`${a.kind} — ${a.columnName}\nFiltro: ${a.filter}\nData: ${new Date(a.createdAt).toLocaleString('it-IT')}\n\n`+Object.entries(a.metrics).map(([k,v])=>`${k.padEnd(38)} ${fmt(v)}`).join('\n'),`report-${a.kind}.txt`,'text/plain;charset=utf-8')}});
$('#csv-file').onchange=async e=>{let f=e.target.files[0];e.target.value='';if(!f)return;try{let t=(await f.text()).replace(/^\uFEFF/,'');addImported(csvParse(t,detectSep(t)),f.name.replace(/\.csv$/i,''))}catch(err){alert(err.message)}};$('#import-csv').onclick=()=>$('#csv-file').click();$('#paste-data').onclick=async()=>{let ans=await modal('Incolla tabella','<p>Incolla i dati copiati da Excel. La prima riga deve contenere le intestazioni.</p><textarea id="paste-area" placeholder="Intestazione 1\tIntestazione 2"></textarea>');if(ans!=='ok')return;try{addImported(csvParse($('#paste-area').value.trim(), '\t'),'Incolla')}catch(e){alert(e.message)}};$('#export-csv').onclick=()=>exportCsv(false);
$('#save-project').onclick=saveProject;$('#project-file').onchange=async e=>{let f=e.target.files[0];e.target.value='';if(f)try{await openProjectFile(f)}catch(err){alert(err.message)}};$('#open-project').onclick=()=>$('#project-file').click();$('#new-project').onclick=async()=>{if(dirty&&await modal('Nuovo progetto','<p>Le modifiche correnti non esportate verranno sostituite. Vuoi continuare?</p>')!=='ok')return;project={formatVersion:2,applicationVersion:'web-0.1',activeSheetId:'',joins:[],sheets:[]};let s=newSheet('Foglio 1',['C1','C2','C3'],[['','','']]);project.sheets=[s];project.activeSheetId=s.id;dirty=true;render()};
$('#join-settings').onclick=async()=>{let opts=project.sheets.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');let body=`<p>Le definizioni di join vengono conservate nel progetto. Questa versione web le salva, ma non esegue ancora la join.</p><div class="join-row"><div><label>Foglio sinistro</label><select id="jl">${opts}</select></div><div><label>Foglio destro</label><select id="jr">${opts}</select></div><div><label>Tipo</label><select id="jt"><option>Left</option><option>Inner</option><option>Full</option></select></div></div><div id="join-keys"></div><ul class="join-list">${project.joins.map(j=>`<li>${esc(j.name)} · ${j.type}</li>`).join('')||'<li>Nessun collegamento salvato.</li>'}</ul>`;let ans=await modal('Collegamenti tra fogli',body,[['Chiudi','cancel','quiet'],['Aggiungi definizione','ok','primary']]);if(ans!=='ok')return;let l=project.sheets.find(s=>s.id===$('#jl').value),r=project.sheets.find(s=>s.id===$('#jr').value);if(l===r)return alert('Seleziona due fogli diversi.');let ln=l.columns[0],rn=r.columns[0];project.joins.push({id:uid(),name:`${l.name}.${ln.name} = ${r.name}.${rn.name}`,leftSheetId:l.id,rightSheetId:r.id,type:$('#jt').value,keys:[{leftColumnId:ln.id,rightColumnId:rn.id}]});touch()};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='o'){e.preventDefault();$('#project-file').click()}});
AnalysisWindows.init({
 getProject:()=>project,getSheet:()=>sheet(),
 saveMetadata:()=>{dirty=true;$('#dirty').textContent='Modifiche non esportate';$('#dirty').className='saved unsaved';localStorage.setItem('statistica-web-autosave',JSON.stringify(project));renderAnalysisNavigation()},
 onActivate:activateAnalysisNavigation,
 setWorkspaceMode:setWorkspaceWindowMode,syncBackdrop:syncWindowBackdrop
});
try{let saved=localStorage.getItem('statistica-web-autosave');if(saved){project=validateProject(JSON.parse(saved));dirty=false;render()}else init()}catch(e){init()}

