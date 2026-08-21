import fs from 'fs';
  import path from 'path';
  import { Session, PAGE_URL } from './session';
  import { Document, FailedDownload } from './types';
                                                                                                                        
  const FORM_ID    = 'listarDetalleInfraccionRAAForm';
  const OUTPUT_DIR = path.join(process.cwd(), 'output', 'pdfs');                                                        
  const MAX_RETRIES  = 3;                                                                                             
  const BASE_DELAY   = 5000;                                                                                            
                                                                                                                        
  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));                                                             
  }                                                                                                                   

  function buildFilename(doc: Document): string {
    const safe = (s: string) => s.replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 60);
    return `${safe(doc.nro)}_${safe(doc.expediente)}.pdf`;                                                              
  }
                                                                                                                        
  export function ensureOutputDirs(): void {                                                                          
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  export async function downloadPdf(
    session: Session,
    doc: Document,                                                                                                      
    failedList: FailedDownload[],
  ): Promise<boolean> {                                                                                                 
    if (!doc.pdfUuid || !doc.pdfButtonId) {                                                                           
      console.log(`  [${doc.nro}] Sin PDF disponible`);
      return false;
    }

    const filepath = path.join(OUTPUT_DIR, buildFilename(doc));                                                         
   
    if (fs.existsSync(filepath)) {                                                                                      
      console.log(`  [${doc.nro}] Ya descargado`);                                                                    
      return true;
    }

    const params = new URLSearchParams();
    params.append(FORM_ID, FORM_ID);
    params.append(doc.pdfButtonId, doc.pdfButtonId);
    params.append('param_uuid', doc.pdfUuid);                                                                           
    params.append('javax.faces.ViewState', session.viewState);
                                                                                                                        
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {                                                        
      try {
        const response = await session.client.post(PAGE_URL, params.toString(), {
          responseType: 'arraybuffer',                                                                                  
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',                                                        
            'Accept': 'application/pdf,application/octet-stream,*/*',                                                 
          },
          timeout: 60000,
          validateStatus: (status) => status < 500,                                                                     
        });
                                                                                                                        
        if (response.status === 429) {                                                                                
          const delay = BASE_DELAY * Math.pow(2, attempt - 1);
          console.log(`  [${doc.nro}] Rate limit 429 — esperando ${delay / 1000}s (intento ${attempt}/${MAX_RETRIES})`);
          await sleep(delay);                                                                                           
          continue;
        }                                                                                                               
                                                                                                                      
        if (response.status !== 200) throw new Error(`HTTP ${response.status}`);

        const contentType = (response.headers['content-type'] ?? '') as string;
        if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
          throw new Error(`Content-Type inesperado: ${contentType}`);                                                   
        }
                                                                                                                        
        fs.writeFileSync(filepath, Buffer.from(response.data as ArrayBuffer));                                        
        console.log(`  [${doc.nro}] OK — ${buildFilename(doc)}`);
        return true;                                                                                                    
   
      } catch (error: any) {                                                                                            
        const delay = BASE_DELAY * Math.pow(2, attempt - 1);                                                          

        if (attempt < MAX_RETRIES) {
          console.log(`  [${doc.nro}] Error intento ${attempt}/${MAX_RETRIES}: ${error?.message} — reintentando en 
  ${delay / 1000}s`);                                                                                                   
          await sleep(delay);
        } else {                                                                                                        
          const reason = error?.message ?? 'Error desconocido';                                                       
          console.log(`  [${doc.nro}] Falló tras ${MAX_RETRIES} intentos: ${reason}`);
          failedList.push({ nro: doc.nro, pdfUuid: doc.pdfUuid!, reason, timestamp: new Date().toISOString() });        
          return false;
        }                                                                                                               
      }                                                                                                               
    }

    return false;                                                                                                       
  }
                                                                                                                        
  export function saveFailed(failedList: FailedDownload[], outputPath: string): void {                                
    fs.writeFileSync(outputPath, JSON.stringify(failedList, null, 2));
    console.log(`Fallidos registrados en: ${outputPath}`);

  }