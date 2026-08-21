import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://publico.oefa.gob.pe';
export const PAGE_URL = `${BASE_URL}/repdig/consulta/consultaTfa.xhtml`;

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
};

export interface Session {
  client: AxiosInstance;
  viewState: string;
}

function createHttpClient(): AxiosInstance {
  let cookieStore = '';

  const client = axios.create({
    timeout: 30000,
    headers: DEFAULT_HEADERS,
    withCredentials: true,
  });

  client.interceptors.request.use((config) => {
    if (cookieStore) config.headers['Cookie'] = cookieStore;
    return config;
  });

  client.interceptors.response.use((response) => {
    const setCookies = response.headers['set-cookie'];
    if (setCookies) {
      const incoming = new Map(
        setCookies.flatMap((c: string) => {
          const part = c.split(';')[0];
          const [k] = part.split('=');
          return [[k.trim(), part]];
        })
      );
      const existing = new Map(
        cookieStore ? cookieStore.split('; ').map(c => {
          const [k] = c.split('=');
          return [k.trim(), c] as [string, string];
        }) : []
      );
      incoming.forEach((val, key) => existing.set(key, val));
      cookieStore = Array.from(existing.values()).join('; ');
    }
    return response;
  });

  return client;
}

export async function createSession(): Promise<Session> {
  const client = createHttpClient();

  console.log('Iniciando sesión...');
  const response = await client.get(PAGE_URL);
  const html = response.data as string;

  const $ = cheerio.load(html);
  const viewState = $('input[name="javax.faces.ViewState"]').val() as string;

  if (!viewState) throw new Error('No se pudo extraer el ViewState');

  console.log('Sesión iniciada OK');
  return { client, viewState };
}
