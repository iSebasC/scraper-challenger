 import * as cheerio from 'cheerio';                                                                                 
  import { Session, PAGE_URL } from './session';
  import { Document, ScraperResult } from './types';

  const FORM_ID   = 'listarDetalleInfraccionRAAForm';                                                                   
  const BUTTON_ID = `${FORM_ID}:btnBuscar`;
  const TABLE_ID  = `${FORM_ID}:dt`;                                                                                    
                                                                                                                      
  const AJAX_HEADERS = {
    'Faces-Request': 'partial/ajax',
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Accept': 'application/xml, text/xml, */*; q=0.01',                                                                 
  };
                                                                                                                        
  function buildSearchParams(viewState: string): string {                                                             
    const p = new URLSearchParams();
    p.append('javax.faces.partial.ajax', 'true');
    p.append('javax.faces.source', BUTTON_ID);                                                                          
    p.append('javax.faces.partial.execute', '@all');
    p.append('javax.faces.partial.render', `${FORM_ID}:pgLista ${FORM_ID}:txtNroexp`);                                  
    p.append(BUTTON_ID, BUTTON_ID);                                                                                   
    p.append(FORM_ID, FORM_ID);                                                                                         
    p.append(`${FORM_ID}:txtNroexp`, '');
    p.append(`${FORM_ID}:j_idt21`, '');                                                                                 
    p.append(`${FORM_ID}:j_idt25`, '');                                                                               
    p.append(`${FORM_ID}:idsector`, '');                                                                                
    p.append(`${FORM_ID}:j_idt34`, '');
    p.append('javax.faces.ViewState', viewState);                                                                       
    return p.toString();                                                                                              
  }

  function buildPageParams(viewState: string, pageIndex: number, totalPages: number): string {                          
    const p = new URLSearchParams();
    p.append('javax.faces.partial.ajax', 'true');                                                                       
    p.append('javax.faces.source', TABLE_ID);                                                                         
    p.append('javax.faces.partial.execute', TABLE_ID);
    p.append('javax.faces.partial.render', `${FORM_ID}:pgLista`);                                                       
    p.append(`${FORM_ID}:dt_pagination`, 'true');
    p.append(`${FORM_ID}:dt_first`, String(pageIndex * 10));                                                            
    p.append(`${FORM_ID}:dt_rows`, '10');                                                                             
    p.append(`${FORM_ID}:dt_page`, String(pageIndex));                                                                  
    p.append(`${FORM_ID}:dt_pageCount`, String(totalPages));
    p.append(FORM_ID, FORM_ID);                                                                                         
    p.append(`${FORM_ID}:txtNroexp`, '');                                                                             
    p.append(`${FORM_ID}:j_idt21`, '');                                                                                 
    p.append(`${FORM_ID}:j_idt25`, '');
    p.append(`${FORM_ID}:idsector`, '');                                                                                
    p.append(`${FORM_ID}:j_idt34`, '');                                                                               
    p.append('javax.faces.ViewState', viewState);                                                                       
    return p.toString();
  }                                                                                                                     
                                                                                                                      
  function parseXmlResponse(xml: string): { html: string; newViewState: string | null } {
    let html = '';
    let newViewState: string | null = null;
                                                                                                                        
    const pgListaIdx = xml.indexOf(':pgLista">');
    if (pgListaIdx !== -1) {                                                                                            
      const cdataOpen = xml.indexOf('<![CDATA[', pgListaIdx);                                                         
      if (cdataOpen !== -1) {
        const contentStart = cdataOpen + '<![CDATA['.length;
        const contentEnd   = xml.indexOf(']]>', contentStart);                                                          
        if (contentEnd !== -1) html = xml.substring(contentStart, contentEnd);
      }                                                                                                                 
    }                                                                                                                 
                                                                                                                      
    const vsIdx = xml.indexOf('javax.faces.ViewState');
    if (vsIdx !== -1) {
      const vsCdata = xml.indexOf('<![CDATA[', vsIdx);
      if (vsCdata !== -1) {                                                                                             
        const vsStart = vsCdata + '<![CDATA['.length;
        const vsEnd   = xml.indexOf(']]>', vsStart);                                                                    
        if (vsEnd !== -1) newViewState = xml.substring(vsStart, vsEnd);                                               
      }                                                                                                                 
    }
                                                                                                                        
    return { html, newViewState };                                                                                    
  }                                                                                                                   

  function parseDocuments(html: string): { documents: Document[]; totalPages: number } {
    const $ = cheerio.load(html);
    const documents: Document[] = [];

    $('tr[data-ri]').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 7) return;                                                                                     
   
      const onclick    = $(cells[6]).find('a').attr('onclick') ?? '';                                                   
      const uuidMatch  = onclick.match(/'param_uuid':'([^']+)'/);                                                     
      const btnMatch   = onclick.match(/'(listarDetalleInfraccionRAAForm[^']+)':/);                                   
                                                                                                                        
      documents.push({
        nro:          $(cells[0]).text().trim(),                                                                        
        expediente:   $(cells[1]).text().trim(),                                                                      
        administrado: $(cells[2]).text().replace(/\s+/g, ' ').trim(),                                                 
        unidad:       $(cells[3]).text().trim(),                                                                        
        sector:       $(cells[4]).text().trim(),
        resolucion:   $(cells[5]).text().trim(),                                                                        
        pdfUuid:      uuidMatch?.[1] ?? null,                                                                         
        pdfButtonId:  btnMatch?.[1]  ?? null,                                                                         
      });                                                                                                               
    });
                                                                                                                        
    const paginatorText = $('.ui-paginator-current').text();                                                          
    const match         = paginatorText.match(/de (\d+)/);                                                            
    const totalPages    = match ? parseInt(match[1], 10) : 1;

    return { documents, totalPages };                                                                                   
  }
                                                                                                                        
  async function fetchAndParse(session: Session, params: string, page: number): Promise<ScraperResult> {              
    const response = await session.client.post(PAGE_URL, params, { headers: AJAX_HEADERS });                          
    const { html, newViewState } = parseXmlResponse(response.data as string);
    if (newViewState) session.viewState = newViewState;                                                                 
   
    if (!html) {                                                                                                        
      console.log(`Página ${page + 1}: sin datos`);                                                                   
      return { documents: [], totalPages: 0, currentPage: page };                                                     
    }

    const { documents, totalPages } = parseDocuments(html);                                                             
    console.log(`Página ${page + 1}/${totalPages} — ${documents.length} documentos`);
    return { documents, totalPages, currentPage: page };                                                                
  }                                                                                                                   
                                                                                                                      
  export async function searchPage(session: Session): Promise<ScraperResult> {
    console.log('Ejecutando búsqueda...');
    return fetchAndParse(session, buildSearchParams(session.viewState), 0);                                             
  }
                                                                                                                        
  export async function navigateToPage(                                                                               
    session: Session,                                                                                                 
    pageIndex: number,
    totalPages: number,
  ): Promise<ScraperResult> {
    return fetchAndParse(session, buildPageParams(session.viewState, pageIndex, totalPages), pageIndex);                
  }