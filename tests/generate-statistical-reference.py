from pathlib import Path
import numpy as np
from scipy import stats
import json,warnings
warnings.filterwarnings('ignore',category=FutureWarning)
rng=np.random.default_rng(427)
cases=[('sample',[20.03,19.98,20.04,20.02,19.96,20.01,20.05,19.99,20,20.03]),('two',[1.,3.]),('five',[2.,3.,5.,8.,9.]),('normal30',rng.normal(size=30).tolist()),('skew30',rng.exponential(size=30).tolist()),('outlier',[*rng.normal(size=40).tolist(),30.]),('large10000',rng.normal(100,3,size=10000).tolist())]
output=[]
for name,data in cases:
 x=np.array(data);n=len(x);item={'name':name,'data':data,'confidence':[]}
 if n>=3:
  a=stats.anderson(x,dist='norm').statistic;adj=a*(1+.75/n+2.25/n**2)
  if adj<.2:p=1-np.exp(-13.436+101.14*adj-223.73*adj**2)
  elif adj<.34:p=1-np.exp(-8.318+42.796*adj-59.938*adj**2)
  elif adj<.6:p=np.exp(.9177-4.279*adj-1.38*adj**2)
  elif adj<=13:p=np.exp(1.2937-5.709*adj+.0186*adj**2)
  else:p=0
  item['ad']={'statistic':float(a),'p':float(p)}
 for c in [50,90,95,99,99.9]:
  alpha=1-c/100;mean=stats.t.interval(c/100,n-1,loc=x.mean(),scale=stats.sem(x));sd=x.std(ddof=1)*np.sqrt((n-1)/stats.chi2.ppf([1-alpha/2,alpha/2],n-1))
  ks=[k for k in range(1,(n+1)//2+1) if stats.binom.cdf(k-1,n,.5)<=alpha/2];k=max(ks,default=0);sortedx=np.sort(x)
  median=[float(sortedx[k-1]),float(sortedx[n-k])] if k else [None,None]
  item['confidence'].append({'level':c,'mean':list(mean),'sd':list(sd),'median':median,'coverage':float(1-2*stats.binom.cdf(k-1,n,.5)) if k else 1.})
 output.append(item)
Path(__file__).resolve().parent.joinpath('fixtures/statistical-reference.json').write_text(json.dumps({'source':'SciPy 1.17: anderson statistic, t/chi2 quantiles, binom.cdf; Stephens p-value formula verified against statsmodels v0.14.6 normal_ad. Seed 427.','cases':output},allow_nan=False))
