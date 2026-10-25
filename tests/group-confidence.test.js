const {test}=require('node:test');
const assert=require('node:assert/strict');
const plots=require('../analysis-plots.js');
const reference=require('./fixtures/statistical-reference.json');
const group=(category,values)=>({category,categoryMissing:false,snapshot:values.map((value,i)=>({row:i+1,value}))});
const analysis=(groups,options={})=>({groups,plotOptions:{groups:options}});
function close(actual,expected,tolerance=5e-7){assert.ok(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`)}

test('Per-cluster confidence intervals match independent SciPy fixtures at editable levels without pooling',()=>{
 const fixtures=reference.cases.filter(c=>['sample','five','normal30'].includes(c.name));
 const groups=fixtures.map(f=>group(f.name,f.data));
 for(const level of [50,95,99.9]){
  const rows=plots.groupConfidenceIntervals(analysis(groups,{confidence:level}));
  assert.equal(rows.length,groups.length);
  rows.forEach((row,i)=>{
   const expected=fixtures[i].confidence.find(c=>c.level===level);
   assert.equal(row.n,fixtures[i].data.length);assert.equal(row.confidence,level);
   for(const [parameter,bounds] of [[0,expected.mean],[1,expected.median],[2,expected.sd]]){
    if(bounds[0]===null){assert.equal(row.intervals[parameter].low,-Infinity);assert.equal(row.intervals[parameter].high,Infinity)}
    else{close(row.intervals[parameter].low,bounds[0]);close(row.intervals[parameter].high,bounds[1])}
   }
   close(row.intervals[1].coverage,expected.coverage);
  });
 }
});
test('Confidence comparison renders one graph per parameter regardless of distribution overlay mode',()=>{
 const groups=[group('A',[1,2,3,4,5,6,7,8]),group('B',[11,13,15,17,19,21,23,25])];
 const options={ciMean:true,ciMedian:true,ciSd:true,confidence:95};
 for(const overlay of [false,true]){
  const html=plots.groupChartsHtml(analysis(groups,{...options,overlay}));
  for(const name of ['mean','median','sd'])assert.equal((html.match(new RegExp(`data-chart="group-ci-${name}"`,'g'))||[]).length,1);
  assert.equal((html.match(/class="group-ci-row"/g)||[]).length,6);
  assert.equal((html.match(/class="group-ci-bar"/g)||[]).length,6);
  assert.ok(!html.includes('group-chart-unit'));
 }
 const onlyMedian=plots.groupChartsHtml(analysis(groups,{ciMedian:true}));
 assert.ok(onlyMedian.includes('group-ci-median'));assert.ok(!onlyMedian.includes('group-ci-mean'));assert.ok(!onlyMedian.includes('group-ci-sd'));
});
test('Confidence options retain selected cluster identity and handle none, missing, and insufficient data',()=>{
 const groups=[group('Vuoto',[]),group('Uno',[1]),group('Costante',Array(8).fill(5)),group('<script>&', [1,2])];
 const a=analysis(groups,{ciMean:true,ciMedian:true,ciSd:true,confidence:99.9});
 const html=plots.groupChartsHtml(a);
 assert.ok(html.includes('Nessun dato numerico valido.'));
 assert.ok(html.includes('IC non limitato'));
 assert.ok(html.includes('−∞'));assert.ok(html.includes('+∞'));
 assert.ok(html.includes('&lt;script&gt;&amp;'));assert.ok(!html.includes('<script>'));
 for(const svg of html.match(/<svg[\s\S]*?<\/svg>/g)||[])assert.ok(!/NaN|Infinity/.test(svg));
 const constant=plots.groupConfidenceIntervals(a)[2];assert.equal(constant.intervals[2].low,0);assert.equal(constant.intervals[2].high,0);
 a.plotOptions.groups.selected=[plots.groupKey(groups[2])];
 assert.deepEqual(plots.groupConfidenceIntervals(a).map(item=>item.group.category),['Costante']);
 const reordered={...a,groups:[...groups].reverse()};assert.equal(plots.groupConfidenceIntervals(reordered)[0].key,plots.groupKey(groups[2]));
 a.plotOptions.groups.selected=[];assert.deepEqual(plots.groupConfidenceIntervals(a),[]);assert.match(plots.groupChartsHtml(a),/Seleziona almeno un cluster/);
});
test('Grouped confidence defaults and level bounds are backward compatible and do not mutate results',()=>{
 const a=analysis([group('A',[1,2,3,4,5,6,7,8])]);const before=JSON.stringify(a);
 const defaults=plots.groupOptions(a);assert.equal(defaults.confidence,95);assert.equal(defaults.ciMean,false);assert.equal(defaults.ciMedian,false);assert.equal(defaults.ciSd,false);
 assert.equal(plots.groupChartsHtml(a),'');plots.groupConfidenceIntervals(a);assert.equal(JSON.stringify(a),before);
 for(const value of [undefined,0,49,100,NaN])assert.equal(plots.groupOptions(analysis(a.groups,{confidence:value})).confidence,95);
 assert.equal(plots.groupOptions(analysis(a.groups,{confidence:99.9})).confidence,99.9);
 assert.equal(plots.groupOptions(analysis(a.groups,{confidence:50})).confidence,50);
});
