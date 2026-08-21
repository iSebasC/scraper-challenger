# OEFA Scraper

TypeScript scraper that extracts all documents from the OEFA public registry and downloads their associated PDFs.

**Target site:** https://publico.oefa.gob.pe/repdig/consulta/consultaTfa.xhtml

## How it works

1. Creates an HTTP session with manual cookie management (no browser automation)
2. Triggers a JSF/PrimeFaces AJAX search to load all documents
3. Paginates through all pages (176 pages, ~1760 documents) using PrimeFaces DataTable AJAX
4. Downloads each PDF via a POST request with the UUID extracted from the page
5. Handles rate limiting (HTTP 429) with exponential backoff
6. Saves all extracted data to `output/data.json` and failed downloads to `output/failed.json`

## Tech stack

- **TypeScript** — required, no browser automation libraries
- **axios** — HTTP requests with manual cookie interceptors
- **cheerio** — HTML/XML parsing

## Installation

```bash
npm install
```

## Usage

```bash
npm start
```

The scraper runs in two phases:

- **Phase 1 — Data extraction:** navigates all pages and saves document metadata to `output/data.json`
- **Phase 2 — PDF download:** downloads PDFs to `output/pdfs/` with a 1s delay between requests

Progress is saved every 10 pages. If interrupted, re-running will skip already-downloaded PDFs automatically.

## Output

```
output/
├── data.json      # all extracted documents (nro, expediente, administrado, unidad, sector, resolucion, pdfUuid)
├── failed.json    # documents where PDF download failed after retries
└── pdfs/          # downloaded PDF files
```

## Error handling

- **HTTP 429 (Too Many Requests):** exponential backoff with up to 3 retries (5s → 10s → 20s)
- **Failed downloads:** logged to `output/failed.json` with timestamp and reason
- **Already downloaded:** skipped on re-run to avoid redundant requests
- **Empty pages:** logged and skipped without crashing

## Project structure

```
src/
├── types.ts       # TypeScript interfaces
├── session.ts     # HTTP client with cookie management and ViewState extraction
├── scraper.ts     # AJAX pagination and document parsing
├── downloader.ts  # PDF download with retry logic
└── index.ts       # Orchestration (Phase 1 + Phase 2)
```
