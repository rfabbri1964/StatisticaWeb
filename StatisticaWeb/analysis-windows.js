/* Independent result windows. Geometry is session UI state; titles are project metadata. */
(function(root){
 'use strict';
 let config=null,renderedProject=null,renderedSheetId=null,changingWorkspace=false;
 const projectStates=new WeakMap();
 const query=s=>document.querySelector(s);
 const cards=()=>[...document.querySelectorAll('#analysis-list .analysis-result-window')];
 const normalized=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,120):'';
 function title(analysis){
  return normalized(analysis.windowOptions?.title)||normalized((analysis.columnName||'Analisi')+(analysis.groupColumnName?' · per '+analysis.groupColumnName:''))||'Analisi';
 }
 function mapFor(project){
  if(!projectStates.has(project))projectStates.set(project,new Map());
  return projectStates.get(project);
 }
 const key=card=>JSON.stringify([card.dataset.sheetId,card.dataset.analysisId]);
 function stateFor(card,project=renderedProject){
  if(!project)return null;
  const map=mapFor(project),id=key(card);
  if(!map.has(id))map.set(id,{mode:'normal',restoreMode:'normal',width:'',height:'',scrollTop:0,restoreParent:false});
  return map.get(id);
 }
 function analysisFor(card){
  if(!config||renderedProject!==config.getProject())return null;
  return renderedProject.sheets.find(sheet=>sheet.id===card.dataset.sheetId)?.analyses.find(analysis=>analysis.id===card.dataset.analysisId)||null;
 }
 function refreshTitleInput(input){input.size=Math.max(10,Math.min(32,[...input.value].length+1))}
 function commitTitle(input=document.activeElement){
  if(!input?.matches?.('.analysis-result-title'))return;
  const card=input.closest('.analysis-result-window'),analysis=card&&analysisFor(card);if(!analysis)return;
  const value=normalized(input.value),next=value||title({...analysis,windowOptions:{}}),changed=next!==title(analysis);
  input.value=next;refreshTitleInput(input);
  card.setAttribute('aria-label','Finestra analisi: '+next);
  if(changed){analysis.windowOptions={...analysis.windowOptions,title:next};config.saveMetadata()}
 }
 function remember(card){
  const state=stateFor(card);if(!state)return;
  state.width=card.style.width;state.height=card.style.height;
  state.mode=card.dataset.windowMode||'normal';
  state.scrollTop=card.querySelector('.analysis-result-content')?.scrollTop||0;
 }
 function updateButtons(card){
  const mode=card.dataset.windowMode||'normal',minimize=card.querySelector('[data-analysis-window-action="minimize"]'),maximize=card.querySelector('[data-analysis-window-action="maximize"]');
  if(minimize){
   minimize.textContent=mode==='minimized'?'▣':'—';minimize.title=mode==='minimized'?'Ripristina analisi':'Riduci analisi';
   minimize.setAttribute('aria-label',minimize.title);minimize.setAttribute('aria-expanded',String(mode!=='minimized'));
  }
  if(maximize){
   maximize.textContent=mode==='maximized'?'❐':'□';maximize.title=mode==='maximized'?'Ripristina dimensioni':'Ingrandisci analisi';
   maximize.setAttribute('aria-label',maximize.title);maximize.setAttribute('aria-pressed',String(mode==='maximized'));
  }
 }
 function sync(){
  document.body.classList.toggle('analysis-card-maximized',hasMaximized());
  if(config)config.syncBackdrop();
 }
 function workspaceMode(name,mode){
  changingWorkspace=true;
  try{config.setWorkspaceMode(name,mode)}finally{changingWorkspace=false}
 }
 function apply(card,state){
  card.style.width=state.width;card.style.height=state.height;card.dataset.windowMode=state.mode;
  updateButtons(card);
  const content=card.querySelector('.analysis-result-content');if(content)content.scrollTop=state.scrollTop;
 }
 function setMode(card,mode,restoreParent=true){
  if(!config||!card||!['normal','minimized','maximized'].includes(mode))return;
  remember(card);
  const state=stateFor(card),previous=state.mode;
  if(mode==='minimized'&&previous!=='minimized')state.restoreMode=previous;
  if(mode==='maximized'&&previous!=='maximized'){
   exitMaximized(false);
   state.restoreParent=query('.analysis-section')?.dataset.windowMode==='maximized';
   if(query('.data-card')?.dataset.windowMode==='maximized')workspaceMode('table','normal');workspaceMode('analysis','normal');
  }
  state.mode=mode;apply(card,state);sync();
  if(previous==='maximized'&&mode!=='maximized'&&restoreParent&&state.restoreParent){
   state.restoreParent=false;workspaceMode('analysis','maximized');sync();
  }
 }
 function hasMaximized(){return cards().some(card=>card.dataset.windowMode==='maximized')}
 function exitMaximized(restoreParent=false){
  if(changingWorkspace)return;
  const maximized=cards().filter(card=>card.dataset.windowMode==='maximized');
  for(const card of maximized)setMode(card,'normal',restoreParent);
  if(!maximized.length)sync();
 }
 function capture(){
  if(!config||!renderedProject)return;
  if(renderedProject===config.getProject()&&renderedSheetId===config.getSheet()?.id)commitTitle();
  cards().forEach(remember);
 }
 function restore(){
  if(!config)return;
  renderedProject=config.getProject();renderedSheetId=config.getSheet()?.id;
  let hasMaximum=false;
  for(const card of cards()){
   const state=stateFor(card);
   if(state.mode==='maximized'){
    if(hasMaximum)state.mode='normal';
    else hasMaximum=true;
   }
   apply(card,state);
   const input=card.querySelector('.analysis-result-title');if(input)refreshTitleInput(input);
  }
  if(hasMaximum){if(query('.data-card')?.dataset.windowMode==='maximized')workspaceMode('table','normal');workspaceMode('analysis','normal')}
  sync();
 }
 function reveal(id){
  if(!config)return;
  const card=cards().find(item=>item.dataset.analysisId===id);if(!card)return;
  const otherMaximum=cards().some(item=>item!==card&&item.dataset.windowMode==='maximized');
  if(otherMaximum)exitMaximized(false);
  if(query('.analysis-section')?.dataset.windowMode==='minimized')workspaceMode('analysis',query('.analysis-section').dataset.restoreMode||'normal');
  const state=stateFor(card);
  if(state.mode==='minimized')setMode(card,state.restoreMode||'normal');
  card.scrollIntoView({block:'nearest',inline:'nearest'});
  if(!card.hasAttribute('tabindex'))card.setAttribute('tabindex','-1');
  card.focus({preventScroll:true});
 }
 function arrange(){
  if(!config)return;
  capture();exitMaximized(false);
  const list=query('#analysis-list'),available=list?.clientWidth||0;if(!available)return;
  const gap=parseFloat(getComputedStyle(list).columnGap)||12,columns=available>=1000?2:1,width=Math.max(1,(available-gap*(columns-1))/columns);
  const area=query('.analysis-window-body'),areaStyle=area&&getComputedStyle(area),height=Math.max(260,(area?.clientHeight||584)-(parseFloat(areaStyle?.paddingTop)||0)-(parseFloat(areaStyle?.paddingBottom)||0));
  for(const card of cards()){
   const state=stateFor(card);state.mode='normal';state.restoreMode='normal';state.width=width+'px';state.height=height+'px';state.restoreParent=false;
   apply(card,state);
  }
  sync();
 }
 function init(settings){
  if(config)return;
  config=settings;
  const list=query('#analysis-list');
  list.addEventListener('click',event=>{
   const button=event.target.closest('[data-analysis-window-action]');if(!button)return;
   const card=button.closest('.analysis-result-window');if(!card)return;
   const state=stateFor(card),action=button.dataset.analysisWindowAction;
   if(action==='minimize')setMode(card,state.mode==='minimized'?(state.restoreMode||'normal'):'minimized');
   if(action==='maximize')setMode(card,state.mode==='maximized'?'normal':'maximized');
  });
  list.addEventListener('dblclick',event=>{
   if(event.target.closest('button,input,select,textarea,label,a,summary'))return;
   const header=event.target.closest('.analysis-card-head'),card=header?.closest('.analysis-result-window');if(!card)return;
   setMode(card,card.dataset.windowMode==='maximized'?'normal':'maximized');
  });
  list.addEventListener('focusin',event=>{
   if(event.target.matches('.analysis-result-title'))event.target.select();
  });
  list.addEventListener('input',event=>{
   if(event.target.matches('.analysis-result-title'))refreshTitleInput(event.target);
  });
  list.addEventListener('focusout',event=>{
   if(event.target.matches('.analysis-result-title'))commitTitle(event.target);
  });
  list.addEventListener('keydown',event=>{
   if(!event.target.matches('.analysis-result-title')||event.isComposing)return;
   if(event.key==='Enter'){event.preventDefault();commitTitle(event.target);event.target.blur()}
   if(event.key==='Escape'){
    event.preventDefault();const analysis=analysisFor(event.target.closest('.analysis-result-window'));
    if(analysis)event.target.value=title(analysis);event.target.blur();
   }
  });
  query('#arrange-analysis-windows')?.addEventListener('click',arrange);
 }
 root.AnalysisWindows={init,title,capture,restore,reveal,commitTitle,exitMaximized,hasMaximized,arrange};
})(globalThis);
