const {test}=require('node:test');
const assert=require('node:assert/strict');
const plots=require('../analysis-plots.js');
const group=(category,values,categoryMissing=false)=>({category,categoryMissing,snapshot:values.map((value,row)=>({value,row}))});
const analysis=(groups,options={})=>({groups,plotOptions:{groups:options}});

test('Overlay histograms share exact bin edges and preserve every observation including maxima',()=>{
 const a=analysis([group('A',[0,1,1,3]),group('B',[1,2,3,3,3]),group('Vide',[])]);
 const result=plots.groupedHistogram(a);
 assert.ok(result.bins.length>1);
 result.series.forEach((series,index)=>{
  assert.deepEqual(series.bins.map(({low,high})=>({low,high})),result.bins);
  assert.equal(series.bins.reduce((sum,bin)=>sum+bin.count,0),a.groups[index].snapshot.length);
  // Count independently using mathematical half-open intervals; only final bin is closed.
  series.bins.forEach((bin,i)=>{
   const expected=a.groups[index].snapshot.filter(({value})=>value>=bin.low&&(value<bin.high||i===series.bins.length-1&&value<=bin.high)).length;
   assert.equal(bin.count,expected);
  });
 });
 assert.equal(result.series[1].bins.at(-1).count,4);
 assert.ok(result.series[2].bins.every(bin=>bin.count===0));
});

test('Shared constant-data histogram pads its range and includes all values',()=>{
 const result=plots.groupedHistogram(analysis([group('A',[5,5]),group('B',[5]),group('Vide',[])]));
 assert.equal(result.bins.length,1);
 assert.ok(result.bins[0].low<5&&result.bins[0].high>5);
 assert.deepEqual(result.series.map(series=>series.bins[0].count),[2,1,0]);
 assert.deepEqual(plots.groupedHistogram(analysis([group('Vide',[])])).bins,[]);
});

test('Cluster selection distinguishes all, none, absent categories and missing-category identity',()=>{
 const groups=[group('(mancante)',[1],false),group('(mancante)',[2],true),group('B',[3])];
 assert.notEqual(plots.groupKey(groups[0]),plots.groupKey(groups[1]));
 assert.equal(plots.groupOptions(analysis(groups)).selected,null);
 assert.equal(plots.groupedHistogram(analysis(groups)).series.length,3);
 const no=analysis(groups,{selected:[]});assert.equal(plots.groupedHistogram(no).series.length,0);assert.equal(plots.groupedHistogram(no).bins.length,0);
 const selected=analysis(groups,{selected:[plots.groupKey(groups[1]),'stale-key']});
 assert.deepEqual(plots.groupedHistogram(selected).series.map(series=>series.key),[plots.groupKey(groups[1])]);
 // Excluding a cluster changes the pooled automatic range, never the data in the other cluster.
 const range=plots.groupedHistogram(analysis([group('Near',[0,1]),group('Far',[100,101])],{selected:[plots.groupKey(group('Near',[]))]}));
 assert.equal(range.bins[0].low,0);assert.equal(range.bins.at(-1).high,1);
});

test('Group chart selection is escaped, stable on reordering, and does not mutate statistical data',()=>{
 const groups=[group('A <script>',[1,2,3,4]),group('B',[10,11,12,13])],key=plots.groupKey(groups[1]);
 const a=analysis(groups,{histogram:true,normality:true,overlay:true,selected:[key]});const before=JSON.stringify(a);
 const html=plots.groupChartsHtml(a);
 assert.match(html,/data-chart="group-histogram"/);assert.match(html,/data-chart="group-normality"/);
 assert.match(html,/data-group-series="\[false,&quot;B&quot;\]"/);
 assert.doesNotMatch(html,/data-group-series="\[false,&quot;A/);
 assert.equal(JSON.stringify(a),before);
 const reordered=analysis([...groups].reverse(),{selected:[key]});
 assert.deepEqual(plots.groupedHistogram(reordered).series.map(series=>series.group.category),['B']);
 const controls=plots.groupControlsHtml(analysis(groups),0);assert.match(controls,/A &lt;script&gt;/);assert.doesNotMatch(controls,/<script>/);
});
