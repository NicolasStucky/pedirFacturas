import soap from 'soap';
import iconv from 'iconv-lite';
import { parseStringPromise } from 'xml2js';
import config from '../config/index.js';

const PARSE_OPTIONS = {
  explicitArray: false,
  mergeAttrs: true,
  trim: true,
};

function pickResponseContainer(result, soapMethod, responseField) {
  if (!result || typeof result !== 'object') return null;

  const candidateKeys = [
    responseField,
    `${soapMethod}Result`,
    'Result',
    ...Object.keys(result),
  ].filter(Boolean);

  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(result, key) && result[key] != null) {
      return { key, value: result[key] };
    }
  }

  return null;
}

function extractXmlPayload(rawValue) {
  if (rawValue == null) return null;

  if (Buffer.isBuffer(rawValue)) {
    return iconv.decode(rawValue, 'windows-1252');
  }

  if (typeof rawValue === 'string') {
    return iconv.decode(Buffer.from(rawValue, 'binary'), 'windows-1252');
  }

  if (typeof rawValue === 'object') {
    if (rawValue.$value != null) {
      return extractXmlPayload(rawValue.$value);
    }

    if (rawValue.anyType != null) {
      const anyType = Array.isArray(rawValue.anyType)
        ? rawValue.anyType.find((item) => item != null)
        : rawValue.anyType;
      if (anyType != null) {
        return extractXmlPayload(anyType);
      }
    }

    const firstValue = Object.values(rawValue).find((value) => value != null);
    if (firstValue != null) {
      return extractXmlPayload(firstValue);
    }
  }

  return null;
}

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
    const container = pickResponseContainer(result, soapMethod, responseField);

    if (!container) {
      const availableKeys = result && typeof result === 'object'
        ? Object.keys(result)
        : [];
      const availableList = availableKeys.length ? availableKeys.join(', ') : 'ninguna';
      const err = new Error(
        `Respuesta inesperada del servicio Suizo: no se encontró un campo con XML (claves disponibles: ${availableList})`
      );
      err.status = 502;
      throw err;
    }

    const xmlString = extractXmlPayload(container.value);
    if (!xmlString) {
      const err = new Error('No se encontró contenido XML en la respuesta del servicio Suizo');
      err.status = 502;
      throw err;
    }

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
      responseField: container.key,
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
