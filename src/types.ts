export interface Document {
  nro: string;
  expediente: string;
  administrado: string;
  unidad: string;
  sector: string;
  resolucion: string;
  pdfUuid: string | null;
  pdfButtonId: string | null;
}

export interface ScraperResult {
  documents: Document[];
  totalPages: number;
  currentPage: number;
}

export interface FailedDownload {
  nro: string;
  pdfUuid: string;
  reason: string;
  timestamp: string;
}
