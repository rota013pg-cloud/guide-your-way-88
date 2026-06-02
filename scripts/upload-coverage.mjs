#!/usr/bin/env node
/**
 * Faz upload recursivo da pasta ./coverage para o bucket público "coverage"
 * no Lovable Cloud (Supabase Storage), usando a Service Role Key.
 *
 * Necessário no ambiente:
 *   SUPABASE_URL                 (ex: https://xxxx.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY    (somente no CI; nunca no frontend)
 *
 * Uso:  node scripts/upload-coverage.mjs
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "coverage";
const SRC_DIR = "coverage";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[upload-coverage] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.");
  process.exit(1);
}
if (!existsSync(SRC_DIR)) {
  console.error(`[upload-coverage] pasta ./${SRC_DIR} não encontrada. Rode 'npm run test:coverage' antes.`);
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".info": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

async function uploadFile(localPath, objectPath) {
  const body = readFileSync(localPath);
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`;
  const contentType = MIME[extname(localPath).toLowerCase()] || "application/octet-stream";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": contentType,
      "x-upsert": "true",
      "cache-control": "public, max-age=60",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`upload falhou para ${objectPath}: HTTP ${res.status} ${await res.text()}`);
  }
}

const files = [...walk(SRC_DIR)];
console.log(`[upload-coverage] enviando ${files.length} arquivos para bucket '${BUCKET}'...`);

let done = 0;
const concurrency = 8;
async function worker(queue) {
  while (queue.length) {
    const f = queue.shift();
    if (!f) break;
    const rel = relative(SRC_DIR, f).split("\\").join("/");
    await uploadFile(f, rel);
    done++;
    if (done % 25 === 0 || done === files.length) {
      console.log(`  ${done}/${files.length}`);
    }
  }
}
const queue = [...files];
await Promise.all(Array.from({ length: concurrency }, () => worker(queue)));

console.log(`[upload-coverage] concluído. Public base: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`);
