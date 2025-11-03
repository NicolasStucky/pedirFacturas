import soap from 'soap';
import iconv from 'iconv-lite';
import { parseStringPromise } from 'xml2js';
import config from '../config/index.js';

const PARSE_OPTIONS = {
  explicitArray: false,
  mergeAttrs: true,
  trim: true,
};

export async function fetchInvoices(payload) {
  const { suizo } = config.providers;
  const {
    wsdlUrl,
    soapMethod = 'Facturas',
    responseField = 'Result',
    endpoint,
    forceSoap12Headers,
  } = suizo;

  try {
    // Crear cliente SOAP
    const client = await soap.createClientAsync(wsdlUrl, {
      ...(endpoint ? { endpoint } : {}),
      ...(forceSoap12Headers ? { forceSoap12Headers: true } : {}),
    });

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

    // Ejecución
    const [result] = await client[`${soapMethod}Async`](payload);
    const raw = result?.[responseField];
    if (!raw) throw new Error('Respuesta inesperada del servicio Suizo');

    // Si viene como objeto con $value, extraer string
    let xmlString = typeof raw === 'string' ? raw : raw?.$value;
    if (!xmlString) throw new Error('No se encontró contenido XML en Result');

    // Convertir desde Windows-1252 a UTF-8
    xmlString = iconv.decode(Buffer.from(xmlString, 'binary'), 'windows-1252');

    // Parsear XML
    const parsedXml = await parseStringPromise(xmlString, PARSE_OPTIONS);

    // Manejar caso de advertencia o datos
    const rows = parsedXml?.VFPData?.row;
    let parsed;

    if (!rows) {
      parsed = { mensaje: 'Sin datos o estructura inesperada' };
    } else if (!Array.isArray(rows) && rows.descripcion) {
      // Mensaje de advertencia
      parsed = { mensaje: rows.descripcion };
    } else {
      // Array de facturas
      parsed = Array.isArray(rows) ? rows : [rows];
    }

    return {
      method: soapMethod,
      responseField,
      rawXml: xmlString,
      parsed,
      cantidad: Array.isArray(parsed) ? parsed.length : undefined,
    };
  } catch (error) {
    if (!error.status) error.status = 502;
    throw error;
  }
}

export default { fetchInvoices };
