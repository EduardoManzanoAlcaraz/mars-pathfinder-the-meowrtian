import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='public/data/jezero-science-v1';const hash=b=>createHash('sha256').update(b).digest('hex');
const topoBytes=await readFile('data/processed/jezero-hirise-v1/manifest.json'),topo=JSON.parse(topoBytes);
const names=['geology.json','objectives.json','photos.json'];
const photos=JSON.parse(await readFile(`${root}/photos.json`,'utf8')).photos;
const files=[];for(const file of [...names,...photos.map(x=>x.file)]){const bytes=await readFile(`${root}/${file}`);files.push({file,bytes:bytes.length,sha256:hash(bytes)});}
await writeFile(`${root}/manifest.json`,JSON.stringify({schema:'mars-pathfinder-science-v1',datasetId:'jezero-science-v1',crsProj:topo.local_crs_proj,topographyManifestSha256:hash(topoBytes),source:'USGS SIM3464 + NASA/JPL Perseverance raw images and official waypoints',geologyAffectsRouting:false,files},null,2)+'\n');
console.log(JSON.stringify({files:files.length,totalBytes:files.reduce((a,b)=>a+b.bytes,0)}));
