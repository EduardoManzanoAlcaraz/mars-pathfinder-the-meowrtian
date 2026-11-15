// Link authentic raw images to exact official rover-motion-counter waypoints, never inferred image targets.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const raw='data/raw/resource-discovery', output='public/data/jezero-science-v1';
await mkdir(`${output}/photos`,{recursive:true}); await mkdir('data/raw/perseverance-photos',{recursive:true});
const digest=b=>createHash('sha256').update(b).digest('hex');
const waypointsBytes=await readFile(`${raw}/rover-waypoints-official.json`), waypoints=JSON.parse(waypointsBytes).features;
const photos=[], requests=[];
for(const sol of [14,107]) {
 let data=JSON.parse(await readFile(`${raw}/raw-sol-${sol}-verified.json`,'utf8'));
 let images=[...data.images];
 const matchImage=im=>im.sol===sol && ['NAVCAM_LEFT','NAVCAM_RIGHT'].includes(im.camera?.instrument) && waypoints.some(w=>w.properties.RMC===`${Number(im.site)}_${Number(im.drive)}` && w.properties.sol===sol);
 for(let page=1; !images.some(matchImage) && page<Math.ceil(Number(data.total_results)/100);page++) {
  const url=`https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&ver=1.2&num=100&page=${page}&order=sol%20asc&condition_2=${sol}:sol:gte&condition_3=${sol}:sol:lte`;
  const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);const body=await r.text();
  const next=JSON.parse(body);if(!next.images.every(x=>x.sol===sol))throw new Error('NASA API ignored requested sol filter');
  await writeFile(`${raw}/raw-sol-${sol}-page-${page}.json`,body);images.push(...next.images);requests.push({url,status:r.status,bytes:Buffer.byteLength(body)});
 }
 const candidates=images.filter(matchImage);
 console.log(`Sol ${sol}: ${images.length} metadata records, ${candidates.length} Navcams at exact same-sol official RMC`);
 if(!candidates.length)throw new Error('No verified camera pose; no photo will be mapped');
 const image=candidates.find(x=>x.camera.instrument==='NAVCAM_LEFT')??candidates[0], rmc=`${Number(image.site)}_${Number(image.drive)}`;
 const poses=waypoints.filter(w=>w.properties.RMC===rmc && w.properties.sol===sol);
 if(poses.length!==1)throw new Error('RMC waypoint is not unique');const pose=poses[0];
 const [lon,lat]=pose.geometry.coordinates;
 const xy=[3396190*Math.cos(18.45*Math.PI/180)*(lon-77.435)*Math.PI/180,3396190*lat*Math.PI/180];
 if(xy[0]<-1968||xy[0]>=1968||xy[1]<1091838||xy[1]>=1095398)throw new Error('Camera waypoint outside actual crop');
 const col=Math.floor((xy[0]+1968)/10),row=Math.floor((1095398-xy[1])/10);
 const mask=await readFile('data/processed/jezero-hirise-v1/routing_valid.u8');if(mask[row*394+col]!==1)throw new Error('Camera pose outside valid topography');
 const bytes=Buffer.from(await (await fetch(image.image_files.medium,{signal:AbortSignal.timeout(45000)})).arrayBuffer());
 if(bytes[0]!==255||bytes[1]!==216)throw new Error('Not a JPEG image');
 const name=`photos/perseverance-sol-${sol}.jpg`;await writeFile(`${output}/${name}`,bytes);await writeFile(`data/raw/perseverance-photos/${image.imageid}.jpg`,bytes);
 await writeFile(`data/raw/perseverance-photos/${image.imageid}.json`,JSON.stringify({image,waypoint:pose},null,2)+'\n');
 photos.push({id:`perseverance-sol-${sol}`,label:`Perseverance · sol ${sol}`,imageId:image.imageid,instrument:image.camera.instrument,utc:image.date_taken_utc+'Z',sol,rmc,
  xy,longitudeEastDeg:lon,latitudePlanetocentricDeg:lat,cell:{col,row},routingMask:1,
  file:name,bytes:bytes.length,sha256:digest(bytes),sourceImageUrl:image.image_files.medium,sourcePageUrl:image.link,metadataUrl:image.json_link,credit:image.credit,
  caption:image.caption,waypoint:{rmc:pose.properties.RMC,sol:pose.properties.sol,site:pose.properties.site,drive:pose.properties.drive,note:pose.properties.Note,coordinates:pose.geometry.coordinates},
  waypointSourceUrl:'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json',waypointSourceSha256:digest(waypointsBytes),
  localizationMethod:'Exact site+drive (RMC) and same-sol join between official raw image record and unique official waypoint; Mars 2000 sphere from official map configuration',
  locationMeaningEs:'Posición documentada del rover al adquirir la imagen; no es la posición del terreno fotografiado. El centro óptico está desplazado respecto al rover. No se deduce la ubicación de rocas visibles.',
  uncertainty:{absoluteAccuracyM:null,noteEs:'El servicio de waypoints no proporciona exactitud absoluta por punto. Se conserva su posición documentada, sin asignar una precisión métrica inventada ni asociar la imagen a un blanco geológico.'}});
}
const manifestBytes=await readFile('data/processed/jezero-hirise-v1/manifest.json');
const payload={schema:'mars-pathfinder-documented-photos-v1',crsProj:JSON.parse(manifestBytes).local_crs_proj,topographyManifestSha256:digest(manifestBytes),photos};
await writeFile(`${output}/photos.json`,JSON.stringify(payload,null,2)+'\n');
await writeFile('docs/science-validation/photo-localization.json',JSON.stringify({...payload,requests},null,2)+'\n');
console.log(JSON.stringify(photos.map(x=>({id:x.id,imageId:x.imageId,rmc:x.rmc,xy:x.xy,cell:x.cell,utc:x.utc,bytes:x.bytes})),null,2));
