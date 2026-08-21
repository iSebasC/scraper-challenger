# OEFA Scraper

Scraper en TypeScript que extrae todos los documentos del registro público de OEFA y descarga los PDFs asociados.

**Sitio objetivo:** https://publico.oefa.gob.pe/repdig/consulta/consultaTfa.xhtml

## Cómo funciona

1. Crea una sesión HTTP con manejo manual de cookies (sin automatización de navegador)
2. Ejecuta una búsqueda AJAX JSF/PrimeFaces para cargar todos los documentos
3. Navega por todas las páginas (176 páginas, ~1760 documentos) usando el AJAX del DataTable de PrimeFaces
4. Descarga cada PDF mediante una petición POST con el UUID extraído de la página
5. Maneja el rate limiting (HTTP 429) con backoff exponencial
6. Guarda todos los datos extraídos en `output/data.json` y los fallos en `output/failed.json`

## Tecnologías

- **TypeScript** — obligatorio, sin librerías de automatización de navegador
- **axios** — peticiones HTTP con interceptors manuales de cookies
- **cheerio** — parsing de HTML/XML

## Instalación

```bash
npm install
```

## Ejecución

```bash
npm start
```

El scraper corre en dos fases:

- **Fase 1 — Extracción de datos:** navega todas las páginas y guarda los metadatos en `output/data.json`
- **Fase 2 — Descarga de PDFs:** descarga los PDFs en `output/pdfs/` con 1s de espera entre cada petición

El progreso se guarda cada 10 páginas. Si se interrumpe, al volver a correr omite automáticamente los PDFs ya descargados.

## Salida

```
output/
├── data.json      # todos los documentos extraídos (nro, expediente, administrado, unidad, sector, resolucion, pdfUuid)
├── failed.json    # documentos donde la descarga del PDF falló tras los reintentos
└── pdfs/          # archivos PDF descargados
```

## Manejo de errores

- **HTTP 429 (Too Many Requests):** backoff exponencial con hasta 3 reintentos (5s → 10s → 20s)
- **Descargas fallidas:** registradas en `output/failed.json` con timestamp y motivo
- **Ya descargados:** omitidos en ejecuciones posteriores para evitar peticiones redundantes
- **Páginas vacías:** registradas y omitidas sin interrumpir la ejecución

## Estructura del proyecto

```
src/
├── types.ts       # interfaces TypeScript
├── session.ts     # cliente HTTP con manejo de cookies y extracción del ViewState
├── scraper.ts     # paginación AJAX y parseo de documentos
├── downloader.ts  # descarga de PDFs con lógica de reintentos
└── index.ts       # orquestación (Fase 1 + Fase 2)
```
