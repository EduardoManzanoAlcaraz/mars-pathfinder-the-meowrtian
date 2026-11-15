import { readFile, writeFile } from 'node:fs/promises';
const cfg=JSON.parse(await readFile('data/raw/resource-discovery/rover-config-api.json','utf8'));
const queries=cfg.layers.filter(x=>['Rover Waypoints','Rover Drive Path'].includes(x.name)).map(x=>[x.name==='Rover Waypoints'?'rover-waypoints-official.json':'rover-traverse-official.json',x.url]);
queries.push(['trek-auto-layers.json','https://trek.nasa.gov/mars/jpl/config/autoLayers.json'],
 ['trek-index-eq.json','https://trek.nasa.gov/mars/TrekServices/ws/index/eq/searchItems?bbox=77.40,18.42,77.47,18.48&key=Jezero&start=0&rows=20&proj=eq'],
 ['trek-mola-capabilities.xml','https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml']);
const report=[];
for(const[name,url]of queries){try{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});const bytes=Buffer.from(await r.arrayBuffer());await writeFile(`data/raw/resource-discovery/${name}`,bytes);report.push({name,url,status:r.status,bytes:bytes.length,atUtc:new Date().toISOString()});console.log(report.at(-1));}catch(e){report.push({name,url,error:String(e)});}}
await writeFile('docs/science-validation/positions-trek-http.json',JSON.stringify(report,null,2)+'\n');
