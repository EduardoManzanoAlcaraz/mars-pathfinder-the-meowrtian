import { build } from 'esbuild';
await build({ entryPoints: ['workers/routing.worker.ts'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: 'dist/workers/routing.worker.js', sourcemap: true });
console.log('Built dist/workers/routing.worker.js');
