const {test}=require('node:test');
const assert=require('node:assert/strict');
const plots=require('../analysis-plots.js');
const reference=require('./fixtures/statistical-reference.json');
const sample=data=>plots.sampleSummary(data.map((value,i)=>({value,row:i+1})));
function close(actual,expected,tolerance=2e-7){assert.ok(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`)}
for(const fixture of reference.cases){
 test(`Numerical reference: ${fixture.name}`,()=>{
  const s=sample(fixture.data);
  if(fixture.ad){const ad=plots.andersonDarling(s);close(ad.statistic,fixture.ad.statistic);close(ad.p,fixture.ad.p)}
  for(const c of fixture.confidence){
   const result=plots.confidenceIntervals(s,c.level);
   for(const [index,expected] of [[0,c.mean],[2,c.sd]]){
    close(result.intervals[index].low,expected[0],5e-7);close(result.intervals[index].high,expected[1],5e-7);
   }
   const median=result.intervals[1];
   if(c.median[0]===null){assert.equal(median.low,-Infinity);assert.equal(median.high,Infinity)}
   else{close(median.low,c.median[0]);close(median.high,c.median[1])}
   close(median.coverage,c.coverage);
  }
 });
}
test('Histogram contains every observation, including maxima and ties',()=>{
 for(const data of [[1],[2,2,2,2],[-4,-1,0,1,10],reference.cases[0].data]){
  const bins=plots.histogram(sample(data));assert.equal(bins.reduce((sum,b)=>sum+b.count,0),data.length);assert.ok(bins.every(b=>b.high>b.low));
 }
});
test('Confidence interval width grows with confidence, and small samples are explicit',()=>{
 const s=sample(reference.cases[0].data),low=plots.confidenceIntervals(s,90),high=plots.confidenceIntervals(s,99);
 high.intervals.forEach((interval,i)=>assert.ok(interval.high-interval.low>=low.intervals[i].high-low.intervals[i].low));
 assert.throws(()=>plots.confidenceIntervals(s,100));
 const single=plots.confidenceIntervals(sample([5]));assert.ok(Number.isNaN(single.intervals[0].low));assert.equal(single.intervals[1].low,-Infinity);
 const constant=plots.confidenceIntervals(sample(Array(10).fill(5)));assert.equal(constant.intervals[2].high,0);
 assert.equal(plots.andersonDarling(sample([1,1,1])).available,false);
 assert.equal(plots.andersonDarling(sample([1,2])).available,false);
});
test('Normality band is reproducible, fitted to all observations, and flags outliers',()=>{
 const s=sample(reference.cases.find(c=>c.name==='outlier').data),result=plots.normality(s),again=plots.normality(s);
 assert.deepEqual(result,again);assert.equal(result.points.length,s.n);assert.ok(result.outside.some(p=>p.row===s.n));assert.ok(result.test.p<.05);
 assert.ok(result.band.every(p=>Number.isFinite(p.low)&&Number.isFinite(p.high)&&p.high>=p.low));
 const translated=plots.normality(sample(reference.cases.find(c=>c.name==='outlier').data.map(v=>3*v+10)));
 assert.deepEqual(result.outside.map(p=>p.row),translated.outside.map(p=>p.row));close(result.test.p,translated.test.p);
});
test('Large sample uses the stated fitted-normal asymptotic band',()=>{
 const result=plots.normality(sample(reference.cases.find(c=>c.name==='large10000').data));
 assert.equal(result.simulated,false);assert.equal(result.points.length,10000);assert.ok(result.points.every(p=>Number.isFinite(p.low)&&Number.isFinite(p.high)));
});
