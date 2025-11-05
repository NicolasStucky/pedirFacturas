import axios from 'axios';
import config from '../config/index.js';

function ensureConfig() {
  const providerConfig = config.providers?.kellerhoff ?? {};
  if (!providerConfig.baseUrl) {
    const error = new Error('KELLERHOFF_BASE_URL no está configurada');
    error.status = 500;
    throw error;
  }
  return providerConfig;
}

function buildUrl(path) {
  const providerConfig = ensureConfig();
  const base = providerConfig.baseUrl.endsWith('/')
    ? providerConfig.baseUrl
    : `${providerConfig.baseUrl}/`;
  return new URL(path, base).toString();
}

function normalizeErrorPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }

  if (typeof payload.mensaje === 'string' && payload.mensaje.trim()) {
    return payload.mensaje;
  }

  if (payload.data && typeof payload.data === 'object') {
    return normalizeErrorPayload(payload.data);
  }

  try {
    return JSON.stringify(payload);
  } catch (_error) {
    return undefined;
  }
}

function handleAxiosError(error, fallbackMessage) {
  const message =
    normalizeErrorPayload(error.response?.data) ??
    error.message ??
    fallbackMessage;

  const err = new Error(message ?? fallbackMessage);
  err.status = error.response?.status || 502;
  err.cause = error;
  throw err;
}

export async function login(credentials) {
  const providerConfig = ensureConfig();
  const url = buildUrl('quantiocloud/token');

  try {
    const { data } = await axios.post(
      url,
      {
        email: credentials.email,
        password: credentials.password
      },
      {
        timeout: providerConfig.timeout
      }
    );

    return data;
  } catch (error) {
    handleAxiosError(error, 'Error autenticando contra Kellerhoff');
  }
}

export async function fetchProducts(payload, token) {
  const providerConfig = ensureConfig();
  const url = buildUrl('quantiocloud/products');

  try {
    const { data } = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      timeout: providerConfig.timeout
    });

    return data;
  } catch (error) {
    handleAxiosError(error, 'Error consultando productos en Kellerhoff');
  }
}

export default {
  login,
  fetchProducts
};
