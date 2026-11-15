// Local dependency/license inventory and complete upstream notices; no production deployment.
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const packages=[], notices=[];
for(const [location,entry] of Object.entries(lock.packages)) {
 if(!location)continue;
 let pkg;try{pkg=JSON.parse(await readFile(resolve(location,'package.json'),'utf8'));}catch{continue;}
 const files=(await readdir(location)).filter(x=>/^(licen[cs]e|copying|notice|ofl)([._-]|$)/i.test(x));
 const licenses=[];
 for(const file of files){const path=resolve(location,file);if(!(await stat(path)).isFile())continue;const text=await readFile(path,'utf8');licenses.push({file,sha256:createHash('sha256').update(text).digest('hex')});notices.push(`\n===== ${pkg.name}@${pkg.version}: ${file} =====\n${text}`);}
 packages.push({name:pkg.name,version:pkg.version,license:pkg.license??entry.license??null,dev:!!entry.dev,repository:pkg.repository??null,notices:licenses});
}
const resolvedMissingNotices=[];
const suites={'@esbuild/win32-x64':'esbuild','@next/env':'next','@next/swc-win32-x64-msvc':'next','@rolldown/binding-win32-x64-msvc':'rolldown','client-only':'react'};
for(const pkg of packages.filter(x=>!x.notices.length)) {
 const suite=suites[pkg.name];
 if(suite){const upstream=packages.find(x=>x.name===suite);if(upstream?.license!==pkg.license)throw new Error(`License mismatch ${pkg.name}`);const notice=upstream.notices.find(x=>/^licen/i.test(x.file));if(!notice)throw new Error(`No upstream notice ${suite}`);const path=`node_modules/${suite}/${notice.file}`,text=await readFile(path,'utf8');notices.push(`\n===== ${pkg.name}@${pkg.version}: same-upstream suite notice ${path} =====\n${text}`);pkg.notices.push({file:path,sha256:createHash('sha256').update(text).digest('hex'),relationship:'Same upstream suite; SPDX matches'});resolvedMissingNotices.push(pkg.name);}
 else if(pkg.name==='lerc'){const text=await readFile('node_modules/lerc/LercDecode.js','utf8'),start=text.indexOf('/*\nCopyright'),end=text.indexOf('*/',start)+2,header=text.slice(start,end);if(!header.includes('Esri'))throw new Error('Missing Esri header');notices.push(`\n===== lerc@${pkg.version}: embedded copyright and Apache-2.0 notice =====\n${header}`);pkg.notices.push({file:'LercDecode.js header',sha256:createHash('sha256').update(header).digest('hex')});resolvedMissingNotices.push(pkg.name);}
}
// Next distributes vendored components with their own notices in dist/compiled.
async function compiled(path){for(const file of await readdir(path)){const absolute=resolve(path,file),info=await stat(absolute);if(info.isDirectory())await compiled(absolute);else if(/^(licen[cs]e|copying|notice)([._-]|$)/i.test(file)){const text=await readFile(absolute,'utf8');notices.push(`\n===== Next.js bundled dependency: ${absolute.slice(resolve('node_modules/next').length+1)} =====\n${text}`);}}}
await compiled('node_modules/next/dist/compiled');
const header=`Mars Pathfinder — The Meowrtian\nThird-party credits and upstream license notices\n\nScientific materials:\nHiRISE: NASA/JPL/University of Arizona; DTM producer includes USGS-Astrogeology. Public-domain imagery: https://www.uahirise.org/media/usage.php\nGeology: Sun, V.Z., and Stack, K.M., 2020, Geologic map of Jezero crater and the Nili Planum region, Mars: USGS Scientific Investigations Map 3464, 1:75,000. https://doi.org/10.3133/sim3464\nUSGS-produced data: U.S. public domain, preserve attribution. https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits\nPerseverance Navcam photographs and rover waypoints: NASA/JPL-Caltech. Image-specific credits and dates retained in photo cards and photos.json. https://mars.nasa.gov/mars2020/multimedia/raw-images/\nNASA/JPL use conditions and non-endorsement: https://www.jpl.nasa.gov/jpl-image-use-policy/\nMars Trek metadata consulted, no Trek raster incorporated. https://trek.nasa.gov/mars/\nThe Meowrtian: reprojection/crops, terrain derivatives, display colors, proposed targets, routes and application. These are not NASA/USGS official stations or a safety certification. No agency logos incorporated.\n\nFont Manrope (SIL OFL-1.1), Lucide icons (ISC), OpenLayers (BSD-2-Clause), Next/React (MIT): full upstream notices follow. Build/test dependency notices included for traceability. The project's original code is licensed under Apache-2.0, explicitly approved by The Meowrtian. See LICENSE and NOTICE in the source repository. Scientific materials and third-party software retain their own terms.\n`;
await writeFile('public/THIRD_PARTY_NOTICES.txt',header+notices.join('\n'));
await writeFile('docs/science-validation/npm-licenses.json',JSON.stringify({auditedAtUtc:new Date().toISOString(),installedPackages:packages.length,packages,resolvedMissingNotices,missingDeclaredLicense:packages.filter(x=>!x.license).map(x=>x.name),missingNoticeFiles:packages.filter(x=>!x.notices.length).map(x=>x.name)},null,2)+'\n');
console.log(JSON.stringify({packages:packages.length,missingDeclaredLicense:packages.filter(x=>!x.license).map(x=>x.name),missingNoticeFiles:packages.filter(x=>!x.notices.length).map(x=>x.name),noticeBytes:Buffer.byteLength(header+notices.join('\n'))}));
