// Release verification only; no hosting or Git mutations.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
const root = process.cwd(), checkout = path.resolve('.cache/github-publication/repository');
const dir = path.resolve('.cache/jury-release-20261115'); await fs.mkdir(path.join(dir, 'logs'), { recursive: true });
await fs.mkdir('docs/jury-release-20261115', { recursive: true });
const npm = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
const results = [];
async function run(name, command, args, cwd = checkout) {
  const start = performance.now(), startedAtUtc = new Date().toISOString();
  const log = await fs.open(path.join(dir, 'logs', `${name}.txt`), 'w');
  try {
    const exitCode = await new Promise((resolve, reject) => {
      const p = spawn(command, args, { cwd, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', PYTHONUTF8: '1' }, stdio: ['ignore', log.fd, log.fd] });
      p.on('error', reject); p.on('exit', resolve);
    });
    const result = { check: name, startedAtUtc, durationMs: Math.round(performance.now() - start), exitCode, passed: exitCode === 0 };
    results.push(result); console.log(JSON.stringify(result));
    await fs.writeFile(path.join(dir, 'checks.json'), JSON.stringify({ checkedAtUtc: new Date().toISOString(), sourceCommit: commit,
      passed: results.length === 5 && results.every(x => x.passed), results }, null, 2) + '\n');
    if (exitCode !== 0) throw new Error(`STOP: ${name} failed; inspect private log`);
  } finally { await log.close(); }
}
await run('build', process.execPath, [npm, 'run', 'build']);
await run('typecheck', process.execPath, [npm, 'run', 'typecheck']);
await run('routing', process.execPath, [npm, 'run', 'test:report']);
await run('interface', process.execPath, [npm, 'run', 'test:interface:report']);
await run('python', path.join(root, '.venv/Scripts/python.exe'), ['-X', 'utf8', '-m', 'pytest', '-q', '--junitxml=docs/jury-release-20261115/pytest.xml'], root);
const routing = JSON.parse(await fs.readFile(path.join(checkout, 'docs/routing-validation/vitest.json'), 'utf8'));
const ui = JSON.parse(await fs.readFile(path.join(checkout, 'docs/interface-validation/vitest.json'), 'utf8'));
const summary = { checkedAtUtc: new Date().toISOString(), sourceCommit: commit, passed: true, results,
  tests: { routing: routing.numPassedTests, interface: ui.numPassedTests, totalVitest: routing.numPassedTests + ui.numPassedTests,
    python: Number((await fs.readFile(path.join(dir, 'logs/python.txt'), 'utf8')).match(/(\d+) passed in/)[1]) },
  pythonScope: 'Full 22-test original-data suite in existing isolated environment; source checkout web tests need only included optimized assets.' };
await fs.writeFile('docs/jury-release-20261115/checks.json', JSON.stringify(summary, null, 2) + '\n');
for (const item of results) {
  let text = await fs.readFile(path.join(dir, 'logs', `${item.check}.txt`), 'utf8');
  for (const prefix of [checkout, checkout.replaceAll('\\', '/'), root, root.replaceAll('\\', '/')]) text = text.split(prefix).join('<workspace>');
  await fs.writeFile(`docs/jury-release-20261115/${item.check}.txt`, text);
}
console.log(JSON.stringify({ passed: true, sourceCommit: commit, tests: summary.tests }));
