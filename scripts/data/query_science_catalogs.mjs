import { readFile,writeFile } from 'node:fs/promises';
const root='data/raw/resource-discovery';
const waypoints=JSON.parse(await readFile(`${root}/rover-waypoints-official.json`,'utf8'));
const selected=waypoints.features.filter(f=>f.properties.RMC==='3_2430'||[107,14].includes(f.properties.sol));
console.log('Candidate waypoints',JSON.stringify(selected.map(f=>({rmc:f.properties.RMC,sol:f.properties.sol,coordinates:f.geometry.coordinates,note:f.properties.Note}))));
const queries=[
 ...['CRISM','THEMIS','Jezero'].map(key=>[`trek-${key.toLowerCase()}-intersects.json`,`https://trek.nasa.gov/mars/TrekServices/ws/index/eq/searchItems?bbox=77.40,18.42,77.47,18.48&key=${key}&start=0&rows=30&proj=eq&intersects=true`]),
 ['raw-sol-107.json','https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&ver=1.2&num=100&page=0&order=date_taken%20asc&search=NAVCAM_LEFT&condition_2=107:sol:gte&condition_3=107:sol:lte'],
];
const report=[];
for(const[name,url]of queries){try{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});const body=await r.text();await writeFile(`${root}/${name}`,body);const data=JSON.parse(body);const summary=name.startsWith('trek')?{found:data.response?.numFound,docs:data.response?.docs?.map(x=>({label:x.productLabel,title:x.title,bbox:x.bbox,resolution:x.resolution,extID:x.extID}))}:{found:data.total_results,images:data.images?.slice(0,3).map(x=>({id:x.imageid,sol:x.sol,site:x.site,drive:x.drive,utc:x.date_taken_utc,instrument:x.camera.instrument}))};report.push({name,url,status:r.status,atUtc:new Date().toISOString(),summary});console.log(JSON.stringify(report.at(-1)));}catch(e){report.push({name,url,error:String(e)});}}
await writeFile('docs/science-validation/catalog-results.json',JSON.stringify(report,null,2)+'\n');
