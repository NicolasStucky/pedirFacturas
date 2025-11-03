import soap from 'soap';
import { parseStringPromise } from 'xml2js';

import config from '../config/index.js';

const PARSE_OPTIONS = {
  explicitArray: false,
  mergeAttrs: true,
  trim: true
};

export async function fetchInvoices(payload) {
  const { suizo } = config.providers;
  const { wsdlUrl, soapMethod, responseField } = suizo;

  try {
    const client = await soap.createClientAsync(wsdlUrl);

    if (typeof client[soapMethod] !== 'function') {
      const error = new Error(
        `El método SOAP "${soapMethod}" no existe en el descriptor proporcionado`
      );
      error.status = 500;
      throw error;
    }

    const [result] = await client[`${soapMethod}Async`](payload);
    const rawXml = result?.[responseField];

    if (!rawXml) {
      const error = new Error('Respuesta inesperada del servicio de Suizo');
      error.status = 502;
      error.details = {
        responseKeys: result ? Object.keys(result) : []
      };
      throw error;
    }

    let parsed;

    try {
      parsed = await parseStringPromise(rawXml, PARSE_OPTIONS);
    } catch (parseError) {
      const error = new Error('No fue posible interpretar la respuesta XML de Suizo');
      error.status = 502;
      error.details = {
        parseError: parseError.message
      };
      throw error;
    }

    return {
      rawXml,
      parsed,
      rawResult: result
    };
  } catch (error) {
    if (!error.status) {
      error.status = 502;
    }

    throw error;
  }
}

export default {
  fetchInvoices
};
