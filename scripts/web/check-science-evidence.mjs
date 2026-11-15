// Validate actual files and recorded runs. This is not a substitute for running tests.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
const json=async name=>JSON.parse(await readFile(name,'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function streamHash(path){const h=createHash('sha256');for await(const chunk of createReadStream(path))h.update(chunk);return h.digest('hex');}
const routing=await json('docs/routing-validation/vitest.json'),ui=await json('docs/interface-validation/vitest.json');
for(const[report,count]of[[routing,37],[ui,27]]){assert.equal(report.success,true);assert.equal(report.numPassedTests,count);assert.equal(report.numFailedTestSuites,0);assert.equal(report.numFailedTests,0);}
const xml=await readFile('docs/science-validation/pytest.xml','utf8');assert.match(xml,/tests="22"/);assert.match(xml,/failures="0"/);assert.match(xml,/errors="0"/);
const manifestBytes=await readFile('public/data/jezero-science-v1/manifest.json'),manifest=JSON.parse(manifestBytes);
const topo=await readFile('data/processed/jezero-hirise-v1/manifest.json');assert.equal(manifest.topographyManifestSha256,sha(topo));assert.equal(manifest.geologyAffectsRouting,false);
assert.deepEqual(await readFile('out/data/jezero-science-v1/manifest.json'),manifestBytes);
for(const entry of manifest.files){const bytes=await readFile(`public/data/jezero-science-v1/${entry.file}`);assert.equal(bytes.length,entry.bytes);assert.equal(sha(bytes),entry.sha256);assert.deepEqual(await readFile(`out/data/jezero-science-v1/${entry.file}`),bytes);}
const downloads=await json('docs/science-validation/usgs-downloads.json');for(const entry of downloads.files)assert.equal(await streamHash(entry.path),entry.sha256);
const inspection=await json('docs/science-validation/sim3464-inspection.json');assert.equal(inspection.zipCRCAllMembersPassed,true);
for(const entry of inspection.extracted)assert.equal(await streamHash(entry.path),entry.sha256);
const repro=await json('docs/science-validation/reproducibility.json');assert.equal(repro.allScienceFilesIdentical,true);
const licenses=await json('docs/science-validation/npm-licenses.json');assert.equal(licenses.missingDeclaredLicense.length,0);assert.equal(licenses.missingNoticeFiles.length,0);
assert.deepEqual(await readFile('out/THIRD_PARTY_NOTICES.txt'),await readFile('public/THIRD_PARTY_NOTICES.txt'));
const browser=await json('docs/interface-validation/browser.json');assert.equal(browser.geology.queriedSourceFid,983);assert.equal(browser.geology.unchangedCostWhenTogglingLayer,4932.615239510466);
assert.equal(browser.scienceObjectives.markersQueriedAtExactCoordinates.length,3);assert.ok(browser.scienceObjectives.independentAudit.passed);assert.equal(browser.photos.authenticImagesLoaded.length,2);assert.ok(browser.corruptScience.originalPlannerStillComputes);
const objectives=(await json('public/data/jezero-science-v1/objectives.json')).objectives;
const document=await readFile('docs/NASA_RESOURCES.md','utf8');
for(const o of objectives){assert.ok(document.includes(`${o.unitSymbol} / ${o.sourceFid}`),`Wrong source FID in documentation: ${o.id}`);assert.ok(document.includes(o.latitudePlanetocentricDeg.toFixed(9)+'°'));}
for(const path of ['README.md','PLAN.md','docs/NASA_RESOURCES.md']){const text=await readFile(path,'utf8');for(const[,link]of text.matchAll(/\]\(([^)]+)\)/g)){if(/^https?:/.test(link))continue;assert.ok(existsSync(resolve(dirname(path),link)),`Broken link ${path}: ${link}`);}}
const report={checkedAtUtc:new Date().toISOString(),vitestRoutingPassed:routing.numPassedTests,vitestInterfaceSciencePassed:ui.numPassedTests,pytestPassed:22,scientificManifestSha256:sha(manifestBytes),scienceAssetsAndStaticCopiesVerified:manifest.files.length,officialUsgsInputsHashVerified:downloads.files.length,extractedSourceFilesHashVerified:inspection.extracted.length,allZipMembersCrcPassed:true,reproducibleSciencePackage:true,npmPackagesAudited:licenses.installedPackages,originalRoutingBehaviourPreserved:true,threeObjectivesAndTwoPhotosDocumented:true,geologyExcludedFromNavigation:true,documentationTargetsAndIdentifiersChecked:true,productionDeploymentPerformed:false};
await writeFile('docs/science-validation/final-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
