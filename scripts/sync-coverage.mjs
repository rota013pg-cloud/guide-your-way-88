#!/usr/bin/env node
/**
 * Copia os artefatos de cobertura gerados pelo Vitest (pasta ./coverage)
 * para public/coverage-report e public/coverage-lcov.info, que são os
 * arquivos lidos pela página /cobertura em runtime.
 *
 * Uso:
 *   node scripts/sync-coverage.mjs
 *
 * Pré-requisito: rodar `npm run test:coverage` antes (gera ./coverage).
 */
import { existsSync, rmSync, cpSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const coverageDir = resolve(root, "coverage");
const publicDir = resolve(root, "public");
const reportDest = resolve(publicDir, "coverage-report");
const lcovSrc = resolve(coverageDir, "lcov.info");
const lcovDest = resolve(publicDir, "coverage-lcov.info");
const summarySrc = resolve(coverageDir, "coverage-summary.json");
const summaryDestPublic = resolve(publicDir, "coverage-summary.json");
const summaryDestReport = resolve(reportDest, "coverage-summary.json");

if (!existsSync(coverageDir)) {
  console.error(
    "[sync-coverage] pasta ./coverage não encontrada. Rode `npm run test:coverage` primeiro."
  );
  process.exit(1);
}

mkdirSync(publicDir, { recursive: true });

// Substitui o relatório HTML inteiro
if (existsSync(reportDest)) rmSync(reportDest, { recursive: true, force: true });
cpSync(coverageDir, reportDest, { recursive: true });

// Arquivos consumidos pela página /cobertura
if (existsSync(lcovSrc)) copyFileSync(lcovSrc, lcovDest);
if (existsSync(summarySrc)) {
  copyFileSync(summarySrc, summaryDestPublic);
  copyFileSync(summarySrc, summaryDestReport);
}

console.log("[sync-coverage] cobertura sincronizada em public/coverage-report");
