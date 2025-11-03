import axios from 'axios';
import config from '../config/index.js';

function ensureConfig() {
  const providerConfig = config.providers?.cofarsur;
  if (!providerConfig?.apiUrl) {
    const error = new Error('COFARSUR_API_URL no está configurada');
    error.status = 500;
    throw error;
  }
  return providerConfig;
}

function unwrapResponse(data) {
  if (!data || typeof data !== 'object') return data;
  if (data.RespuestaExportacionComprobantes) {
    return data.RespuestaExportacionComprobantes;
  }
  if (data.respuesta) {
    return data.respuesta;
  }
  return data;
}

export async function fetchComprobantes(payload) {
  const providerConfig = ensureConfig();

  try {
    const { data } = await axios.post(
      providerConfig.apiUrl,
      { DatosExportacionComprobantes: payload },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: providerConfig.timeout
      }
    );

    const response = unwrapResponse(data);
    if (!response) {
      throw new Error('Respuesta vacía del servicio Cofarsur');
    }

    return response;
  } catch (error) {
    const err = new Error(
      error.response?.data?.mensaje ||
      error.response?.data?.error ||
      error.message ||
      'Error llamando al servicio Cofarsur'
    );
    err.status = error.response?.status || 502;
    err.cause = error;
    throw err;
  }
}

export default { fetchComprobantes };
