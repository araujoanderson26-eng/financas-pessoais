import { readFile } from 'node:fs/promises';
const hosting = JSON.parse(await readFile(new URL('../dist/.openai/hosting.json', import.meta.url), 'utf8'));
if (!hosting || typeof hosting !== 'object') throw new Error('Manifesto inválido.');
const { default: worker } = await import('../dist/server/index.js');
if (typeof worker?.fetch !== 'function') throw new Error('Worker sem default.fetch.');
console.log('Artefato validado: Worker ESM, default.fetch e manifesto.');
