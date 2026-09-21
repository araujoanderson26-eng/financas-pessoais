import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['node_modules/vinext/dist/cli.js', 'build'], { stdio: 'inherit', timeout: 240000 });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
await import('./validate-artifact.mjs');
