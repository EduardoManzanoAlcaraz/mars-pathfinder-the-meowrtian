import {readFile,writeFile} from 'node:fs/promises';
const root='data/raw/resource-discovery';
const day=JSON.parse(await readFile(`${root}/trek-themis-intersects.json`,'utf8')).response.docs;
const crism=JSON.parse(await readFile(`${root}/trek-crism-intersects.json`,'utf8')).response.docs;
const jezero=JSON.parse(await readFile(`${root}/trek-jezero-intersects.json`,'utf8')).response.docs;
const wanted=[day.find(x=>x.productLabel?.startsWith('THEMIS_Night')),crism.find(x=>x.productLabel==='frt_07_brcarj_mtr3_ll'),jezero.find(x=>x.productLabel?.startsWith('JEZ_hirise_soc_006_DTM')),jezero.find(x=>x.productLabel?.startsWith('JEZ_ctx_B_soc_008_ortho'))];
const report=[];
for(const doc of wanted){
 const url=`https://trek.nasa.gov/mars/TrekServices/ws/index/getLayerServices?uuid=${doc.item_UUID}`;
 const r=await fetch(url,{signal:AbortSignal.timeout(45000)});const text=await r.text();await writeFile(`${root}/trek-services-${doc.item_DBID}.json`,text);
 report.push({productLabel:doc.productLabel,title:doc.title,catalogUuid:doc.item_UUID,bbox:doc.bbox,projectionIdentifier:doc.projection,catalogResolution:doc.resolution??doc.Resolution,description:doc.description,serviceRequest:{url,status:r.status},services:r.ok?JSON.parse(text):null,incorporated:false});
}
const label='THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018';
const url=`https://trek.nasa.gov/tiles/Mars/EQ/${label}/1.0.0/WMTSCapabilities.xml`,r=await fetch(url,{signal:AbortSignal.timeout(45000)});
await writeFile(`${root}/trek-themis-night-capabilities.xml`,await r.text());
await writeFile('docs/science-validation/trek-review.json',JSON.stringify({queriedAoiLonLat:[77.40,18.42,77.47,18.48],queryPredicate:'intersects=true (within returns no products for this small AOI)',catalogCounts:{jezero:jezero.length,crism:crism.length,themis:day.length},reviewed:report,wmts:{url,status:r.status},rasterIntegrated:false,conclusion:'THEMIS night can add thermal context at 100 m; CRISM catalog intersection does not prove valid spectra or mineral detections in crop; controlled HiRISE/CTX duplicate available terrain data. No Trek pixels are used in route calculations or map layers.'},null,2)+'\n');
console.log(JSON.stringify(report.map(x=>({label:x.productLabel,servicesStatus:x.serviceRequest.status,services:x.services})),null,2));
