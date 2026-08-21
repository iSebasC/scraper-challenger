import fs from 'fs';
import path from 'path';
import { createSession } from './session';
import { searchPage, navigateToPage } from './scraper';
import { downloadPdf, ensureOutputDirs, saveFailed } from './downloader';
import { Document, FailedDownload } from './types';

const OUTPUT_DIR  = path.join(process.cwd(), 'output');
const DATA_FILE   = path.join(OUTPUT_DIR, 'data.json');
const FAILED_FILE = path.join(OUTPUT_DIR, 'failed.json');

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function saveProgress(documents: Document[]): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(documents, null, 2));
}

async function main(): Promise<void> {
  console.log('=== SCRAPER OEFA — Inicio ===\n');

  ensureOutputDirs();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const session = await createSession();

  // ── Fase 1: extraer todos los documentos ─────────────────────────────────
  console.log('\n--- Fase 1: Extracción de datos ---\n');

  const firstResult = await searchPage(session);
  const totalPages  = firstResult.totalPages;
  let allDocuments: Document[] = [...firstResult.documents];

  console.log(`Total páginas detectadas: ${totalPages}`);

  for (let pageIndex = 1; pageIndex < totalPages; pageIndex++) {
    await sleep(1000);
    try {
      const result = await navigateToPage(session, pageIndex, totalPages);
      allDocuments.push(...result.documents);

      if (pageIndex % 10 === 0) {
        saveProgress(allDocuments);
        console.log(`  → Progreso guardado (${allDocuments.length} documentos)`);
      }
    } catch (err: any) {
      console.error(`  Error en página ${pageIndex + 1}: ${err?.message}`);
      await sleep(5000);
    }
  }

  saveProgress(allDocuments);
  console.log(`\nFase 1 completa: ${allDocuments.length} documentos extraídos`);
  console.log(`Guardado en: ${DATA_FILE}\n`);

  // ── Fase 2: descargar PDFs ────────────────────────────────────────────────
  console.log('--- Fase 2: Descarga de PDFs ---\n');

  const failedList: FailedDownload[] = [];
  let downloaded = 0;
  let skipped    = 0;

  for (let i = 0; i < allDocuments.length; i++) {
    const doc = allDocuments[i];
    process.stdout.write(`[${i + 1}/${allDocuments.length}] `);

    if (!doc.pdfUuid) {
      console.log(`[${doc.nro}] Sin PDF`);
      skipped++;
      continue;
    }

    const ok = await downloadPdf(session, doc, failedList);
    if (ok) downloaded++;

    await sleep(1000);

    if ((i + 1) % 50 === 0) {
      saveFailed(failedList, FAILED_FILE);
    }
  }

  saveFailed(failedList, FAILED_FILE);

  // ── Resumen final ─────────────────────────────────────────────────────────
  console.log('\n=== Resumen final ===');
  console.log(`Documentos extraídos : ${allDocuments.length}`);
  console.log(`PDFs descargados     : ${downloaded}`);
  console.log(`Sin PDF              : ${skipped}`);
  console.log(`Fallidos             : ${failedList.length}`);
  console.log(`Datos JSON           : ${DATA_FILE}`);
  console.log(`Fallidos JSON        : ${FAILED_FILE}`);
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
