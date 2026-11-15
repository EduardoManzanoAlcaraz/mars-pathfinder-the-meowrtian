import { readFile, writeFile } from 'node:fs/promises';
const text=await readFile('data/raw/resource-discovery/rover-map-main.js','utf8');
for(const term of ['config_get','configure/','getConfig','api/configure','api:function','get: "','configuration_get']){let i=text.indexOf(term);if(i>=0)console.log(term,text.slice(Math.max(0,i-200),i+450));}
const config=JSON.parse(await readFile('data/raw/resource-discovery/trek-config.json','utf8'));
const queries=[
 ['trek-jezero-equirect.json',config.services.searchItemsUrl.replace('PROJECTION','equirect').replace('bbox=','bbox=77.40,18.42,77.47,18.48').replace('key=','key=Jezero').replace('start=','start=0').replace('rows=','rows=30')],
 ['rover-config-map-relative.json','https://mars.nasa.gov/maps/location/Missions/M20/config.json'],
 ['rover-config-api.json','https://mars.nasa.gov/maps/location/api/configure/get?mission=M20'],
 ['trek-basemaps.json','https://trek.nasa.gov/mars/jpl/config/basemaps.json'],
];
const report=[];for(const[name,url]of queries){try{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});const body=await r.text();await writeFile(`data/raw/resource-discovery/${name}`,body);report.push({name,url,status:r.status,bytes:body.length,atUtc:new Date().toISOString()});console.log(report.at(-1));}catch(e){report.push({name,url,error:String(e)});}}
await writeFile('docs/science-validation/nasa-services.json',JSON.stringify(report,null,2)+'\n');
