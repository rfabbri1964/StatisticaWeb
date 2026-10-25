/* Statistical graphics. Distribution functions: vendored jStat 1.9.6 (MIT).
 * AD normality: Stephens finite-sample adjustment and p-value approximation
 * used by statsmodels.stats.diagnostic.normal_ad (normal mean/variance fitted).
 * Median interval: central, distribution-free binomial/order-statistic interval.
 */
(function(root){
 'use strict';
 const distribution=typeof module==='object'&&module.exports?require('./vendor/jstat.min.js'):root.jStat;
 const escapeText=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const numberText=x=>Number.isFinite(x)?new Intl.NumberFormat('it-IT',{maximumSignificantDigits:7}).format(x):x===Infinity?'+∞':x===-Infinity?'−∞':'Non disponibile';
 const compact=x=>new Intl.NumberFormat('it-IT',{maximumSignificantDigits:4}).format(x);
 const prepared=new WeakMap(),envelopes=new Map();
 function sampleSummary(observations){
  const sorted=observations.filter(o=>Number.isFinite(o.value)).map(o=>({...o})).sort((a,b)=>a.value-b.value);
  const n=sorted.length;if(!n)return{sorted,n,mean:NaN,sd:NaN,median:NaN};
  // Center first to reduce cancellation for data with a large location offset.
  const origin=sorted[0].value,mean=origin+sorted.reduce((sum,o)=>sum+(o.value-origin),0)/n;
  const ss=sorted.reduce((sum,o)=>sum+(o.value-mean)**2,0);
  return{sorted,n,mean,sd:n>1?Math.sqrt(ss/(n-1)):NaN,median:n%2?sorted[n>>1].value:(sorted[n/2-1].value+sorted[n/2].value)/2};
 }
 function quantile(values,p){const pos=(values.length-1)*p,i=Math.floor(pos);return values[i]+(values[Math.min(i+1,values.length-1)]-values[i])*(pos-i)}
 function logNormalCDF(z){
  if(z<-5){
   // Mills ratio continued fraction avoids underflow/cancellation in the tails.
   const x=-z;let tail=0;
   for(let k=120;k>=1;k--)tail=k/(x+tail);
   return-.5*x*x-.5*Math.log(2*Math.PI)-Math.log(x+tail);
  }
  if(z>5)return Math.log1p(-Math.exp(logNormalCDF(-z)));
  return Math.log(distribution.normal.cdf(z,0,1));
 }
 function andersonDarling(summary){
  const {sorted,n,mean,sd}=summary;
  if(n<3)return{available:false,reason:'Servono almeno 3 valori validi per il test Anderson–Darling.'};
  if(!(sd>0))return{available:false,reason:'Il test di normalità non è definito quando tutti i valori sono uguali.'};
  let sum=0;
  for(let i=0;i<n;i++)sum+=(2*i+1)*(logNormalCDF((sorted[i].value-mean)/sd)+logNormalCDF(-(sorted[n-1-i].value-mean)/sd));
  const statistic=Math.max(0,-n-sum/n),adjusted=statistic*(1+.75/n+2.25/(n*n));
  let p;
  if(adjusted<.2)p=1-Math.exp(-13.436+101.14*adjusted-223.73*adjusted*adjusted);
  else if(adjusted<.34)p=1-Math.exp(-8.318+42.796*adjusted-59.938*adjusted*adjusted);
  else if(adjusted<.6)p=Math.exp(.9177-4.279*adjusted-1.38*adjusted*adjusted);
  else p=Math.exp(1.2937-5.709*adjusted+.0186*adjusted*adjusted);
  // The final Stephens approximation is calibrated only up to A* = 13.
  if(adjusted>13)p=0;
  return{available:true,statistic,adjusted,p:Math.max(0,Math.min(1,p)),smallSample:n<8};
 }
 function confidenceIntervals(summary,confidence=95){
  if(!(confidence>=50&&confidence<=99.9))throw Error('Il livello di confidenza deve essere tra 50 e 99,9%.');
  const {sorted,n,mean,sd,median}=summary,alpha=1-confidence/100;
  const meanInterval={name:'Media',estimate:mean,low:NaN,high:NaN,method:'t di Student'},medianInterval={name:'Mediana',estimate:median,low:-Infinity,high:Infinity,method:'Binomiale esatto',coverage:1},sdInterval={name:'Deviazione standard campionaria',estimate:sd,low:NaN,high:NaN,method:'Chi-quadro'};
  if(n>=2){
   const t=distribution.studentt.inv(1-alpha/2,n-1),half=t*sd/Math.sqrt(n);
   meanInterval.low=mean-half;meanInterval.high=mean+half;
   sdInterval.low=sd*Math.sqrt((n-1)/distribution.chisquare.inv(1-alpha/2,n-1));
   sdInterval.high=sd*Math.sqrt((n-1)/distribution.chisquare.inv(alpha/2,n-1));
  }
  // Largest k with P(Binomial(n,.5) <= k-1) <= alpha/2.
  // Evaluating the CDF only during binary search avoids an O(n) loop.
  if(n){
   let lo=0,hi=Math.floor((n+1)/2);
   while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(distribution.binomial.cdf(mid-1,n,.5)<=alpha/2)lo=mid;else hi=mid-1}
   if(lo>0){medianInterval.low=sorted[lo-1].value;medianInterval.high=sorted[n-lo].value;medianInterval.coverage=1-2*distribution.binomial.cdf(lo-1,n,.5)}
  }
  return{confidence,n,intervals:[meanInterval,medianInterval,sdInterval]};
 }
 function histogramDefaults(summary){
  const values=summary.sorted.map(o=>o.value),n=values.length;
  if(!n)return{count:0,method:'Nessun dato'};
  const span=values[n-1]-values[0];
  if(!span)return{count:1,method:'Dati costanti'};
  const iqr=quantile(values,.75)-quantile(values,.25),width=2*iqr/Math.cbrt(n);
  const raw=width>0?Math.ceil(span/width):Math.ceil(Math.log2(n)+1);
  return{count:Math.max(1,Math.min(40,raw)),method:width>0?'Freedman–Diaconis':'Sturges',capped:raw>40};
 }
 function histogram(summary,requested=null){
  if(requested!==null&&(!Number.isInteger(requested)||requested<1||requested>200))throw Error('Il numero di bin deve essere un intero tra 1 e 200.');
  const values=summary.sorted.map(o=>o.value),n=values.length;
  if(!n)return[];
  let low=values[0],high=values[n-1];
  const count=requested??histogramDefaults(summary).count;
  if(high===low){const pad=Math.max(Math.abs(low)*.01,.5);low-=pad;high+=pad}
  const width=(high-low)/count,bins=Array.from({length:count},(_,i)=>({low:low+i*width,high:low+(i+1)*width,count:0}));
  values.forEach(value=>bins[Math.min(count-1,Math.max(0,Math.floor((value-low)/width)))].count++);
  return bins;
 }
 function envelope(n){
  if(envelopes.has(n))return envelopes.get(n);
  // Reproducible pointwise parametric Monte Carlo envelope, refitting location
  // and sample SD in each simulated normal sample. Not a simultaneous band.
  // Above 2000 observations use the fitted-normal quantile asymptotic variance.
  const simulated=n<=2000,count=simulated?n:301;
  const indices=Array.from({length:count},(_,j)=>Math.round(j*(n-1)/(count-1||1)));
  const points=indices.map(i=>{const p=(i+.625)/(n+.25);return{i,p,z:distribution.normal.inv(p,0,1)}});
  if(simulated){
   const samples=points.map(()=>[]);let state=(0x6d2b79f5^n)>>>0;
   const uniform=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return(state+.5)/4294967296};
   for(let b=0;b<1200;b++){
    const xs=[];
    for(let j=0;j<n;j+=2){const radius=Math.sqrt(-2*Math.log(uniform())),angle=2*Math.PI*uniform();xs.push(radius*Math.cos(angle));if(j+1<n)xs.push(radius*Math.sin(angle))}
    const mean=xs.reduce((a,v)=>a+v,0)/n,sd=Math.sqrt(xs.reduce((a,v)=>a+(v-mean)**2,0)/(n-1));
    xs.sort((a,b)=>a-b);points.forEach((point,j)=>samples[j].push((xs[point.i]-mean)/sd));
   }
   points.forEach((point,j)=>{samples[j].sort((a,b)=>a-b);point.low=quantile(samples[j],.025);point.high=quantile(samples[j],.975)});
  }else{
   const critical=distribution.normal.inv(.975,0,1);
   points.forEach(point=>{const density=distribution.normal.pdf(point.z,0,1),se=Math.sqrt(Math.max(0,point.p*(1-point.p)/(density*density)-1-point.z*point.z/2)/n);point.low=point.z-critical*se;point.high=point.z+critical*se});
  }
  const result={points,simulated};if(envelopes.size>=8)envelopes.delete(envelopes.keys().next().value);envelopes.set(n,result);return result;
 }
 function normality(summary){
  const test=andersonDarling(summary);
  if(!test.available)return{test,points:[],outside:[],band:[]};
  const band=envelope(summary.n),bounds=[];
  let j=0;
  for(let i=0;i<summary.n;i++){
   while(j<band.points.length-1&&band.points[j+1].i<=i)j++;
   const left=band.points[j];
   if(band.simulated)bounds.push({low:summary.mean+summary.sd*left.low,high:summary.mean+summary.sd*left.high});
   else{
    const p=(i+.625)/(summary.n+.25),z=distribution.normal.inv(p,0,1),density=distribution.normal.pdf(z,0,1),half=distribution.normal.inv(.975,0,1)*Math.sqrt(Math.max(0,p*(1-p)/(density*density)-1-z*z/2)/summary.n);
    bounds.push({low:summary.mean+summary.sd*(z-half),high:summary.mean+summary.sd*(z+half)});
   }
  }
  const points=summary.sorted.map((o,i)=>{const z=distribution.normal.inv((i+.625)/(summary.n+.25),0,1);return{...o,z,...bounds[i],outside:o.value<bounds[i].low||o.value>bounds[i].high}});
  return{test,points,outside:points.filter(o=>o.outside),band:band.points.map(point=>({z:point.z,low:summary.mean+summary.sd*point.low,high:summary.mean+summary.sd*point.high})),simulated:band.simulated};
 }
 function getPrepared(a){
  if(!prepared.has(a))prepared.set(a,{summary:sampleSummary(a.snapshot||[])});
  return prepared.get(a);
 }
 function chartFrame(label){return`<svg viewBox="0 0 560 290" role="img" aria-label="${escapeText(label)}">`}
 function chartAxis(min,max,left=68,right=540){
  if(!(max>min)){const pad=Math.max(Math.abs(min)*.01,.5);min-=pad;max+=pad}
  const map=value=>left+(value-min)/(max-min)*(right-left);
  const ticks=Array.from({length:5},(_,i)=>{const raw=min+(max-min)*i/4,value=Math.abs(raw)<(max-min)*1e-12?0:raw,x=map(value);return`<line x1="${x}" x2="${x}" y1="238" y2="243" stroke="#91a0b0"/><text x="${x}" y="258" text-anchor="middle">${escapeText(compact(value))}</text>`}).join('');
  return{map,ticks,min,max};
 }
 function histogramHtml(summary,requested=null){
  const bins=histogram(summary,requested);if(!bins.length)return'<p>Nessun dato valido.</p>';
  const x=chartAxis(bins[0].low,bins[bins.length-1].high),maxCount=Math.max(...bins.map(b=>b.count)),y=value=>238-value/maxCount*206;
  return`<section class="stat-plot" data-chart="histogram"><h4>Istogramma</h4>${chartFrame('Istogramma dei dati generali')}<text x="68" y="16">Frequenza</text>${[0,.5,1].map(t=>`<line x1="68" x2="540" y1="${y(t*maxCount)}" y2="${y(t*maxCount)}" stroke="#edf0f3"/><text x="60" y="${y(t*maxCount)+4}" text-anchor="end">${escapeText(compact(t*maxCount))}</text>`).join('')}${bins.map(b=>`<rect class="histogram-bin" x="${x.map(b.low)+1}" y="${y(b.count)}" width="${Math.max(1,x.map(b.high)-x.map(b.low)-2)}" height="${238-y(b.count)}" fill="#4b8ee8"><title>${escapeText(numberText(b.low))} – ${escapeText(numberText(b.high))}: ${b.count}</title></rect>`).join('')}${x.ticks}<text x="304" y="282" text-anchor="middle">Valore</text></svg><p>${summary.n} valori validi · ${bins.length} bin · ${requested===null?histogramDefaults(summary).method:'Scelta manuale'} · dati complessivi.</p></section>`;
 }
 function normalityHtml(a,summary){
  const cache=getPrepared(a);if(!cache.normal)cache.normal=normality(summary);const result=cache.normal;
  if(!result.test.available)return`<section class="stat-plot" data-chart="normality"><h4>Normality plot · banda 95%</h4><p>${escapeText(result.test.reason)}</p></section>`;
  const {points,band,test}=result;
  const low=Math.min(points[0].value,...band.map(p=>p.low)),high=Math.max(points[points.length-1].value,...band.map(p=>p.high)),pad=(high-low)*.06;
  const y=value=>238-(value-low+pad)/(high-low+2*pad)*206;
  const x=chartAxis(points[0].z,points[points.length-1].z);
  const polygon=band.map(p=>`${x.map(p.z)},${y(p.low)}`).concat([...band].reverse().map(p=>`${x.map(p.z)},${y(p.high)}`)).join(' ');
  // Keep every point outside the band; thin only interior points for large SVGs.
  const stride=Math.max(1,Math.ceil(points.length/1500));
  const drawn=points.filter((p,i)=>p.outside||i%stride===0||i===points.length-1);
  const pText=test.p<.0001?'&lt; 0,0001':numberText(test.p);
  return`<section class="stat-plot" data-chart="normality"><h4>Normality plot · banda 95%</h4><p class="normality-test">Anderson–Darling: A² = <strong>${numberText(test.statistic)}</strong> · <strong>p-value ${test.p<.0001?'':'='} ${pText}</strong></p>${chartFrame('Normality plot Q-Q con banda puntuale al 95 per cento e dati fuori banda in rosso')}<text x="68" y="16">Valore osservato</text>${[0,.5,1].map(t=>{const value=low+(high-low)*t;return`<line x1="68" x2="540" y1="${y(value)}" y2="${y(value)}" stroke="#edf0f3"/><text x="60" y="${y(value)+4}" text-anchor="end">${escapeText(compact(value))}</text>`}).join('')}<polygon class="normality-band" points="${polygon}" fill="#1769e022" stroke="#7ea8e0" stroke-width="1"/><line x1="${x.map(points[0].z)}" y1="${y(summary.mean+summary.sd*points[0].z)}" x2="${x.map(points[points.length-1].z)}" y2="${y(summary.mean+summary.sd*points[points.length-1].z)}" stroke="#1769e0" stroke-dasharray="5 3"/>${drawn.map(p=>`<circle class="normality-point${p.outside?' outside-band':''}" data-row="${p.row}" cx="${x.map(p.z)}" cy="${y(p.value)}" r="${p.outside?4:2.8}" fill="${p.outside?'#ce3543':'#1769e0'}"><title>Riga ${p.row}: ${escapeText(numberText(p.value))}${p.outside?' · FUORI BANDA':''}</title></circle>`).join('')}${x.ticks}<text x="304" y="282" text-anchor="middle">Quantile normale teorico</text></svg><p><span class="outside-legend">● Rosso</span>: <strong>${result.outside.length}</strong> dati fuori banda. Banda <strong>puntuale</strong> 95% ${result.simulated?'Monte Carlo (1200 campioni normali con media e σ ristimate)':'asintotica con media e σ stimate'}; non è una banda simultanea.</p><p>p-value approssimato di Stephens, con media e varianza stimate.${test.smallSample?' Campione piccolo (N &lt; 8): interpretare il p-value con cautela.':''} Il test usa tutti gli ${summary.n} valori.${stride>1?' Nel grafico sono diradati solo i punti interni alla banda.':''}</p></section>`;
 }
 function intervalHtml(summary,confidence){
  const result=confidenceIntervals(summary,confidence);
  return`<section class="stat-plot" data-chart="intervals"><h4>Intervalli di confidenza · ${numberText(confidence)}%</h4>${result.intervals.map(interval=>{
   const finite=Number.isFinite(interval.low)&&Number.isFinite(interval.high);
   let graph='';
   if(finite){
    const span=interval.high-interval.low,pad=span>0?span*.12:Math.max(Math.abs(interval.estimate)*.01,.5);
    const x=chartAxis(interval.low-pad,interval.high+pad,68,540);
    graph=`<svg viewBox="0 0 560 95" role="img" aria-label="Intervallo di confidenza per ${escapeText(interval.name)}"><line x1="${x.map(interval.low)}" x2="${x.map(interval.high)}" y1="28" y2="28" stroke="#1769e0" stroke-width="3"/>${[interval.low,interval.high].map(value=>`<line x1="${x.map(value)}" x2="${x.map(value)}" y1="19" y2="37" stroke="#1769e0" stroke-width="2"/>`).join('')}<circle cx="${x.map(interval.estimate)}" cy="28" r="5" fill="#1769e0"/><text x="${x.map(interval.low)}" y="62" text-anchor="middle">${escapeText(numberText(interval.low))}</text><text x="${x.map(interval.high)}" y="82" text-anchor="middle">${escapeText(numberText(interval.high))}</text></svg>`;
   }
   return`<div class="ci-parameter" data-parameter="${escapeText(interval.name)}"><h5>${escapeText(interval.name)}: ${escapeText(numberText(interval.estimate))}</h5>${graph}<p class="ci-bounds">IC: [<span data-ci-low>${escapeText(numberText(interval.low))}</span>; <span data-ci-high>${escapeText(numberText(interval.high))}</span>] · ${interval.method}${interval.coverage!==undefined?' · copertura effettiva '+numberText(100*interval.coverage)+'%':''}</p>${!finite?`<p>${interval.name==='Mediana'?'Campione insufficiente per un intervallo bilaterale finito a questo livello di confidenza.':'Servono almeno 2 valori validi.'}</p>`:''}</div>`;
  }).join('')}<p>Scale separate per i tre parametri. IC individuali: media con t di Student; mediana con binomiale esatto (conservativo); deviazione standard con chi-quadro. Gli IC di media e deviazione standard assumono osservazioni indipendenti da una popolazione normale; l’IC della mediana non richiede normalità.</p></section>`;
 }
 function options(a){
  const saved=a.plotOptions||{};
  const confidence=Number(saved.confidence);
  return{histogramBins:Number.isInteger(saved.histogramBins)&&saved.histogramBins>=1&&saved.histogramBins<=200?saved.histogramBins:null,histogram:!!saved.histogram,normality:!!saved.normality,intervals:!!saved.intervals,confidence:confidence>=50&&confidence<=99.9?confidence:95};
 }
 function controlsHtml(a,index){
  const selected=options(a),auto=histogramDefaults(getPrepared(a).summary);
  return`<fieldset class="plot-options"><legend>Grafici · dati complessivi</legend>${[['histogram','Istogramma'],['normality','Normality plot · banda 95% e Anderson–Darling'],['intervals','Intervalli di confidenza: media, mediana, dev. standard']].map(([key,label])=>`<label><input type="checkbox" data-plot-option="${key}" data-analysis-index="${index}"${selected[key]?' checked':''}> ${label}</label>`).join('')}<div class="histogram-controls"${selected.histogram?'':' hidden'}><label for="histogram-bins-${index}">Numero di bin (1–200)</label><input id="histogram-bins-${index}" type="number" min="1" max="200" step="1" value="${selected.histogramBins??(auto.count||1)}" data-plot-option="histogramBins" data-analysis-index="${index}"><button type="button" class="quiet small" data-auto-bins="${index}" title="Ripristina il numero di bin automatico">Automatico</button><p class="histogram-bin-mode">${selected.histogramBins===null?'Automatico: '+auto.method+(auto.capped?' · limite 40 bin':''):'Scelta manuale'}</p></div><div class="confidence-control"${selected.intervals?'':' hidden'}><label for="confidence-${index}">Livello di confidenza IC (%)</label><input id="confidence-${index}" type="number" min="50" max="99.9" step="0.1" value="${selected.confidence}" data-plot-option="confidence" data-analysis-index="${index}"><input type="range" min="50" max="99.9" step="0.1" value="${selected.confidence}" aria-label="Livello di confidenza IC" data-plot-option="confidence" data-analysis-index="${index}"></div></fieldset>`;
 }
 function chartsHtml(a){
  const selected=options(a);if(!selected.histogram&&!selected.normality&&!selected.intervals)return'';
  const {summary}=getPrepared(a);
  if(!summary.n)return'<p>Nessun dato numerico valido nel risultato salvato.</p>';
  return(selected.histogram?histogramHtml(summary,selected.histogramBins):'')+(selected.normality?normalityHtml(a,summary):'')+(selected.intervals?intervalHtml(summary,selected.confidence):'');
 }
 // Cluster graphics use the saved group snapshots, never the current data table.
 function groupKey(group){return JSON.stringify([!!group.categoryMissing,String(group.category??'')])}
 function groupLabel(group){return group.categoryMissing?'(mancante · valore assente)':String(group.category??'')}
 function groupOptions(a){
  const saved=a.plotOptions?.groups||{};
  return{histogram:!!saved.histogram,normality:!!saved.normality,overlay:!!saved.overlay,selected:Array.isArray(saved.selected)?saved.selected.filter(key=>typeof key==='string'):null};
 }
 function groupSeries(a){
  const selected=groupOptions(a).selected;
  return(a.groups||[]).map((group,index)=>({group,key:groupKey(group),index,color:groupColor(index),summary:getPrepared(group).summary})).filter(item=>selected===null||selected.includes(item.key));
 }
 function groupColor(index){return['#1769e0','#c04c00','#00856b','#9c3dbb','#c12a61','#7b6311','#087d9e','#555fc4'][index]||`hsl(${Math.round(index*137.508)%360} 65% 36%)`}
 function groupControlsHtml(a,index){
  if(!a.groups?.length)return'';
  const state=groupOptions(a),count=a.groups.filter(group=>state.selected===null||state.selected.includes(groupKey(group))).length;
  return`<fieldset class="plot-options group-plot-options"><legend>Grafici per cluster</legend>${[['histogram','Istogramma'],['normality','Diagramma dei quantili normalizzati (Q-Q normale)']].map(([key,label])=>`<label><input type="checkbox" data-group-plot-option="${key}" data-analysis-index="${index}"${state[key]?' checked':''}> ${label}</label>`).join('')}<details class="group-selector group-cluster-menu"><summary>Cluster da visualizzare · ${count} di ${a.groups.length}</summary><div class="group-selector-menu group-cluster-panel"><div class="group-selection-actions group-cluster-actions"><button type="button" class="quiet small" data-group-select="all" data-analysis-index="${index}">Seleziona tutti</button><button type="button" class="quiet small" data-group-select="none" data-analysis-index="${index}">Deseleziona tutti</button></div><div class="group-cluster-list">${a.groups.map((group,i)=>`<label><input type="checkbox" data-group-key="${escapeText(groupKey(group))}" data-analysis-index="${index}"${state.selected===null||state.selected.includes(groupKey(group))?' checked':''}><span class="group-color group-chart-swatch" style="background:${groupColor(i)}" aria-hidden="true"></span><span>${escapeText(groupLabel(group))} · N = ${getPrepared(group).summary.n}</span></label>`).join('')}</div></div></details><label><input type="checkbox" data-group-plot-option="overlay" data-analysis-index="${index}"${state.overlay?' checked':''}> Sovrapponi i grafici dei cluster</label></fieldset>`;
 }
 function groupedHistogram(a){
  const series=groupSeries(a),pooled=sampleSummary(series.flatMap(item=>item.summary.sorted)),common=histogram(pooled);
  if(!common.length)return{series:series.map(item=>({...item,bins:[]})),bins:[],method:'Nessun dato'};
  const low=common[0].low,high=common[common.length-1].high,width=(high-low)/common.length;
  return{bins:common.map(bin=>({low:bin.low,high:bin.high})),method:histogramDefaults(pooled).method,series:series.map(item=>{
   const bins=common.map(bin=>({low:bin.low,high:bin.high,count:0}));
   item.summary.sorted.forEach(observation=>{const i=Math.min(bins.length-1,Math.max(0,Math.floor((observation.value-low)/width)));bins[i].count++});
   return{...item,bins};
  })};
 }
 function groupLegend(series){return`<ul class="group-plot-legend group-chart-legend">${series.map(item=>`<li data-group-key="${escapeText(item.key)}"><span class="group-color group-chart-swatch" style="background:${item.color}" aria-hidden="true"></span>${escapeText(groupLabel(item.group))} · N = ${item.summary.n}</li>`).join('')}</ul>`}
 function overlayHistogramHtml(a){
  const result=groupedHistogram(a),{series,bins}=result;
  if(!bins.length)return'<section class="stat-plot" data-chart="group-histogram"><h4>Istogrammi sovrapposti</h4><p>Nessun dato numerico valido nei cluster selezionati.</p></section>';
  const x=chartAxis(bins[0].low,bins[bins.length-1].high),maxCount=Math.max(1,...series.map(item=>Math.max(0,...item.bins.map(bin=>bin.count)))),y=count=>238-count/maxCount*206;
  return`<section class="stat-plot" data-chart="group-histogram"><h4>Istogrammi sovrapposti</h4>${groupLegend(series)}${chartFrame('Istogrammi dei cluster sovrapposti con classi e scale comuni')}<text x="68" y="16">Frequenza per cluster</text>${[0,.5,1].map(t=>`<line x1="68" x2="540" y1="${y(t*maxCount)}" y2="${y(t*maxCount)}" stroke="#edf0f3"/><text x="60" y="${y(t*maxCount)+4}" text-anchor="end">${escapeText(compact(t*maxCount))}</text>`).join('')}${series.map(item=>`<g data-group-series="${escapeText(item.key)}">${item.bins.map(bin=>`<rect class="histogram-bin" data-count="${bin.count}" x="${x.map(bin.low)+1}" y="${y(bin.count)}" width="${Math.max(1,x.map(bin.high)-x.map(bin.low)-2)}" height="${238-y(bin.count)}" fill="${item.color}" fill-opacity="0.32" stroke="${item.color}" stroke-width="1"><title>${escapeText(groupLabel(item.group))} · ${escapeText(numberText(bin.low))} – ${escapeText(numberText(bin.high))}: ${bin.count}</title></rect>`).join('')}</g>`).join('')}${x.ticks}<text x="304" y="282" text-anchor="middle">Valore</text></svg><p>${bins.length} classi comuni · ${result.method} sui dati dei cluster selezionati. Frequenze assolute, barre trasparenti; le numerosità dei cluster possono differire.</p></section>`;
 }
 function overlayNormalityHtml(a){
  const series=groupSeries(a).map(item=>{const cache=getPrepared(item.group);if(!cache.normal)cache.normal=normality(item.summary);return{...item,result:cache.normal}}),available=series.filter(item=>item.result.test.available);
  const reports=series.map(item=>{const test=item.result.test;return`<li><span class="group-color group-chart-swatch" style="background:${item.color}" aria-hidden="true"></span><strong>${escapeText(groupLabel(item.group))}</strong>: ${test.available?`Anderson–Darling A² = ${numberText(test.statistic)}; p-value ${test.p<.0001?'&lt; 0,0001':'= '+numberText(test.p)}${test.smallSample?' · N &lt; 8, interpretare con cautela':''}`:escapeText(test.reason)}</li>`}).join('');
  let graph='';
  if(available.length){
   // Shared limits include every band's endpoints and every observed point.
   let low=Infinity,high=-Infinity,minZ=Infinity,maxZ=-Infinity;
   available.forEach(item=>{const {points,band}=item.result;low=Math.min(low,points[0].value);high=Math.max(high,points[points.length-1].value);minZ=Math.min(minZ,points[0].z);maxZ=Math.max(maxZ,points[points.length-1].z);band.forEach(point=>{low=Math.min(low,point.low);high=Math.max(high,point.high)})});
   const pad=Math.max((high-low)*.06,.000001),y=value=>238-(value-low+pad)/(high-low+2*pad)*206,x=chartAxis(minZ,maxZ);
   graph=chartFrame('Diagrammi Q-Q normali sovrapposti dei cluster, con scale comuni')+`<text x="68" y="16">Valore osservato</text>${[0,.5,1].map(t=>{const value=low+(high-low)*t;return`<line x1="68" x2="540" y1="${y(value)}" y2="${y(value)}" stroke="#edf0f3"/><text x="60" y="${y(value)+4}" text-anchor="end">${escapeText(compact(value))}</text>`}).join('')}`+available.map(item=>{
    const {points,band}=item.result,summary=item.summary,stride=Math.max(1,Math.ceil(points.length/1500));
    const polygon=band.map(point=>`${x.map(point.z)},${y(point.low)}`).concat([...band].reverse().map(point=>`${x.map(point.z)},${y(point.high)}`)).join(' ');
    return`<g data-group-series="${escapeText(item.key)}"><polygon class="normality-band" points="${polygon}" fill="${item.color}" fill-opacity="0.06" stroke="${item.color}" stroke-opacity="0.35"/><line x1="${x.map(points[0].z)}" x2="${x.map(points[points.length-1].z)}" y1="${y(summary.mean+summary.sd*points[0].z)}" y2="${y(summary.mean+summary.sd*points[points.length-1].z)}" stroke="${item.color}" stroke-dasharray="5 3"/>${points.filter((point,i)=>point.outside||i%stride===0||i===points.length-1).map(point=>`<circle class="normality-point${point.outside?' outside-band':''}" data-row="${point.row}" cx="${x.map(point.z)}" cy="${y(point.value)}" r="${point.outside?4:2.8}" fill="${item.color}" stroke="${point.outside?'#ce3543':item.color}" stroke-width="${point.outside?2:0}"><title>${escapeText(groupLabel(item.group))} · riga ${point.row}: ${escapeText(numberText(point.value))}${point.outside?' · FUORI BANDA':''}</title></circle>`).join('')}</g>`;
   }).join('')+`${x.ticks}<text x="304" y="282" text-anchor="middle">Quantile normale teorico</text></svg>`;
  }
  return`<section class="stat-plot" data-chart="group-normality"><h4>Diagrammi dei quantili normalizzati sovrapposti</h4>${groupLegend(series)}${graph}<ul class="group-normality-tests">${reports}</ul><p>Q-Q: quantili normali teorici sull’asse orizzontale, valori osservati sull’asse verticale. Ogni cluster conserva media e deviazione standard proprie. Bande puntuali al 95% per cluster, non simultanee; bordo rosso per punti fuori dalla propria banda. Il test usa tutti i valori; nei campioni grandi sono diradati solo i punti interni alle bande.</p></section>`;
 }
 function groupChartsHtml(a){
  const state=groupOptions(a);if(!state.histogram&&!state.normality)return'';
  const series=groupSeries(a);if(!series.length)return'<p class="group-plot-empty">Seleziona almeno un cluster da visualizzare.</p>';
  if(state.overlay)return(state.histogram?overlayHistogramHtml(a):'')+(state.normality?overlayNormalityHtml(a):'');
  return series.map(item=>`<div class="group-chart-unit" data-group-key="${escapeText(item.key)}"><h4 class="group-chart-title"><span class="group-color group-chart-swatch" style="background:${item.color}" aria-hidden="true"></span>Cluster: ${escapeText(groupLabel(item.group))} · N = ${item.summary.n}</h4>${state.histogram?(item.summary.n?histogramHtml(item.summary).replace('dati complessivi.','dati del cluster.'):'<section class="stat-plot" data-chart="histogram"><h4>Istogramma</h4><p>Nessun dato numerico valido in questo cluster.</p></section>'):''}${state.normality?normalityHtml(item.group,item.summary):''}</div>`).join('');
 }
 const api={groupKey,groupOptions,groupControlsHtml,groupChartsHtml,groupedHistogram,sampleSummary,andersonDarling,confidenceIntervals,histogram,histogramDefaults,normality,controlsHtml,chartsHtml,options};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.AnalysisPlots=api;
})(globalThis);

