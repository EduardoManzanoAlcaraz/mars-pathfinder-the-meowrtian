import {writeFile,readFile} from 'node:fs/promises';
const reports=[];
for(const sol of [14,107]){
 const url=`https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&ver=1.2&num=100&page=0&order=sol%20asc&condition_2=${sol}:sol:gte&condition_3=${sol}:sol:lte`;
 const r=await fetch(url,{signal:AbortSignal.timeout(45000)});const body=await r.text();await writeFile(`data/raw/resource-discovery/raw-sol-${sol}-verified.json`,body);
 const data=JSON.parse(body);const sols=[...new Set(data.images?.map(x=>x.sol))];
 reports.push({sol,url,status:r.status,returnedSols:sols,filterApplied:sols.length===1&&sols[0]===sol,returned:data.images?.length,total:data.total_results,atUtc:new Date().toISOString()});
 console.log(JSON.stringify(reports.at(-1)));
}
const trek=JSON.parse(await readFile('data/raw/resource-discovery/trek-themis-intersects.json','utf8'));
console.log('THEMIS metadata:',JSON.stringify(trek.response.docs.find(x=>x.productLabel?.startsWith('THEMIS_Night'))));
await writeFile('docs/science-validation/photo-candidate-http.json',JSON.stringify(reports,null,2)+'\n');
