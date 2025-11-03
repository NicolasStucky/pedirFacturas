import soap from 'soap';
import path from 'path';
import fs from 'fs';
import config from '../config/index.js';

function buildWsdlCandidates(p) {
  const list = [];
  if (p.wsdlUrl) list.push(p.wsdlUrl);
  if (p.wsdlUrlAlt1) list.push(p.wsdlUrlAlt1);
  if (p.wsdlUrlAlt2) list.push(p.wsdlUrlAlt2);
  if (p.wsdlUrlAlt3) list.push(p.wsdlUrlAlt3);

  // Si no se configuró nada, probamos heurísticas comunes:
  if (list.length === 0) {
    list.push(
      'https://www.cofarsur.net/ws?wsdl',
      'https://www.cofarsur.net/ws?WSDL',
      'http://www.cofarsur.net/ws?wsdl',
      'http://www.cofarsur.net/ws?WSDL'
    );
  }
  return list;
}

function unwrapResponse(obj, responseField) {
  if (!obj || typeof obj !== 'object') return obj;
  if (responseField && obj[responseField] != null) return obj[responseField];
  const altKey = Object.keys(obj).find((k) => /return|respuesta|response/i.test(k));
  return altKey ? obj[altKey] : obj;
}

async function tryCreateClientFromUrl(url, endpoint, timeout) {
  try {
    const client = await soap.createClientAsync(url, {
      endpoint,
      wsdl_headers: { Connection: 'keep-alive' },
      wsdl_options: { timeout }
    });
    return client;
  } catch (e) {
    // re-lanzamos con info de URL
    const err = new Error(`Invalid WSDL URL: ${url}${e.response?.status ? ` (HTTP ${e.response.status})` : ''}`);
    err.cause = e;
    throw err;
  }
}

async function createSoapClient(provider) {
  const { endpoint, timeout } = provider;

  // 1) Probar URLs remotas
  const candidates = buildWsdlCandidates(provider);
  for (const url of candidates) {
    try {
      return await tryCreateClientFromUrl(url, endpoint, timeout);
    } catch (e) {
      // seguimos probando
      // console.warn(e.message); // si querés loguearlo
    }
  }

  // 2) Si hay archivo local, usarlo
  if (provider.wsdlFile) {
    const wsdlPath = path.resolve(process.cwd(), provider.wsdlFile);
    if (!fs.existsSync(wsdlPath)) {
      const err = new Error(`WSDL local no encontrado: ${wsdlPath}`);
      err.status = 500;
      throw err;
    }
    const client = await soap.createClientAsync(wsdlPath, {
      endpoint,
      wsdl_headers: { Connection: 'keep-alive' },
      wsdl_options: { timeout }
    });
    return client;
  }

  // 3) Nada funcionó
  const err = new Error(
    'No fue posible obtener el WSDL de Cofarsur. Configure COFARSUR_WSDL_FILE con un archivo local (ver instrucciones).'
  );
  err.status = 500;
  throw err;
}

export async function fetchComprobantes(payload) {
  const provider = config.providers?.cofarsur;
  if (!provider) {
    const err = new Error('Config de proveedor Cofarsur ausente');
    err.status = 500;
    throw err;
  }

  const {
    soapMethod = 'ExportacionComprobantes',
    responseField = 'return'
  } = provider;

  try {
    const client = await createSoapClient(provider);

    if (typeof client[soapMethod] !== 'function') {
      const desc = client.describe?.() ?? {};
      const available = Object.entries(desc)
        .flatMap(([svc, ports]) =>
          Object.entries(ports || {}).flatMap(([port, methods]) =>
            Object.keys(methods || {}).map((m) => `${svc}.${port}.${m}`)
          )
        );
      const err = new Error(
        `Método SOAP "${soapMethod}" no encontrado. Disponibles: ${available.join(', ')}`
      );
      err.status = 500;
      throw err;
    }

    // RPC/encoded → usar el part exacto
    const args = { DatosExportacionComprobantes: payload };

    const [result] = await client[`${soapMethod}Async`](args);
    const unwrapped = unwrapResponse(result, responseField);

    if (!unwrapped || typeof unwrapped !== 'object') {
      const e = new Error('Respuesta inesperada del servicio Cofarsur (sin body)');
      e.status = 502;
      e.raw = result;
      throw e;
    }

    return unwrapped;
  } catch (error) {
    const err = new Error(
      error.body?.faultstring ||
      error.response?.data?.mensaje ||
      error.message ||
      'Error llamando a Cofarsur'
    );
    err.status = error.response?.status || 502;
    err.cause = error;
    throw err;
  }
}

export default { fetchComprobantes };
