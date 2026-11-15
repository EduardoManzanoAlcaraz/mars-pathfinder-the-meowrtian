import { writeFile } from 'node:fs/promises';
const entries=[
 ['trek-jezero.json','https://trek.nasa.gov/mars/TrekServices/ws/index/EQ/searchItems?bbox=77.40,18.42,77.47,18.48&key=Jezero&start=0&rows=30&facetKeys=&facetValues=&intersects=&proj=EQ'],
 ['trek-crism.json','https://trek.nasa.gov/mars/TrekServices/ws/index/EQ/searchItems?bbox=77.40,18.42,77.47,18.48&key=CRISM&start=0&rows=30&facetKeys=&facetValues=&intersects=&proj=EQ'],
 ['rover-map-config.json','https://mars.nasa.gov/Missions/M20/config.json'],
];
const report=[];for(const[name,url]of entries){try{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});const body=await r.text();await writeFile(`data/raw/resource-discovery/${name}`,body);report.push({name,url,status:r.status,bytes:body.length,atUtc:new Date().toISOString()});console.log(report.at(-1));}catch(e){report.push({name,url,error:String(e)});}}
await writeFile('docs/science-validation/catalog-probes.json',JSON.stringify(report,null,2)+'\n');
