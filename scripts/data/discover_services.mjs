import { readFile, mkdir, writeFile } from 'node:fs/promises';
const raw='data/raw/resource-discovery'; await mkdir(raw,{recursive:true});
for (const name of ['rover-map-main.js','raw-main.js']) {
  const body=await readFile(`${raw}/${name}`,'utf8');
  const terms=name==='raw-main.js'?['condition_2','camera_position','latitude','sol_start']:['waypoints.json','traverse.json','config.json','M20','missionPath','geojson/mars2020'];
  for(const term of terms) { let index=body.indexOf(term), count=0; while(index>=0&&count++<5){console.log(name,term,body.slice(Math.max(0,index-100),index+220));index=body.indexOf(term,index+term.length);} }
}
const urls=[
 ['trek-config.json','https://trek.nasa.gov/mars/jpl/config/config.json'],
 ['rover-waypoints.json','https://mars.nasa.gov/maps/location/geojson/mars2020/waypoints.json'],
 ['rover-traverse.json','https://mars.nasa.gov/maps/location/geojson/mars2020/traverse.json'],
 ['raw-sol-84.json','https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&ver=1.2&num=5&page=0&order=sol%20asc&condition_2=84:sol:gte&condition_3=84:sol:lte'],
];
const report=[];
for(const [name,url] of urls){try{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});const bytes=Buffer.from(await r.arrayBuffer()); await writeFile(`${raw}/${name}`,bytes);const entry={name,url,status:r.status,bytes:bytes.length,atUtc:new Date().toISOString()};report.push(entry);console.log(JSON.stringify(entry));}catch(e){report.push({name,url,error:String(e)});}}
await writeFile('docs/science-validation/service-discovery.json',JSON.stringify(report,null,2)+'\n');
