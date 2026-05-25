// Exporta el spec OpenAPI a un JSON estático bajo docs/, para alimentar
// la referencia Redoc embebida en la wiki MkDocs.
//
//   cd server && npm run docs:openapi
//
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { openApiSpec } from '../src/swagger.js';

const outDir = path.resolve(process.cwd(), '..', 'docs');
mkdirSync(outDir, { recursive: true });

const outFile = path.join(outDir, 'openapi.json');
writeFileSync(outFile, JSON.stringify(openApiSpec, null, 2) + '\n');

const opCount = Object.values(openApiSpec.paths ?? {}).reduce(
  (acc, item) => acc + Object.keys(item as Record<string, unknown>).length,
  0,
);
console.log(`OpenAPI spec escrito en ${outFile} (${opCount} operaciones).`);
