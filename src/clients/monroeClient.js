import axios from 'axios';
import config from '../config/index.js';

function ensureConfig() {
  const providerConfig = config.providers?.monroe ?? {};
  if (!providerConfig.baseUrl) {
    const error = new Error('MONROE_BASE_URL no está configurada');
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

function sanitizeVersionPath(versionPath = '') {
  const trimmed = versionPath.trim();
  if (!trimmed) return '';
  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
}

function handleAxiosError(error, fallbackMessage) {
  const err = new Error(
    error.response?.data?.mensaje ||
    error.response?.data?.error ||
    error.response?.data?.message ||
    error.message ||
    fallbackMessage
  );
  err.status = error.response?.status || 502;
  err.cause = error;
  throw err;
}

export async function login(credentials) {
  const providerConfig = ensureConfig();
  const url = buildUrl('Auth/login');

  const params = {
    software_key: credentials.softwareKey,
  };

  if (credentials.customerKey) {
    params.ecommerce_customer_key = credentials.customerKey;
  }

  if (credentials.customerReference) {
    params.ecommerce_customer_reference = credentials.customerReference;
  }

  if (Number.isFinite(credentials.tokenDuration)) {
    params.token_duration = credentials.tokenDuration;
  }

  try {
    const { data } = await axios.post(url, null, {
      params,
      timeout: providerConfig.timeout,
    });
    return data;
  } catch (error) {
    handleAxiosError(error, 'Error autenticando contra Monroe');
  }
}

export async function fetchComprobantes(params, token) {
  const providerConfig = ensureConfig();
  const versionPath = sanitizeVersionPath(providerConfig.adeVersion ?? 'ade/1.0.0');
  const path = versionPath ? `${versionPath}/consultarComprobantes` : 'consultarComprobantes';
  const url = buildUrl(path);

  try {
    const { data } = await axios.get(url, {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: providerConfig.timeout,
    });

    return data;
  } catch (error) {
    handleAxiosError(error, 'Error consultando comprobantes en Monroe');
  }
}

export async function fetchComprobanteDetalle(identifier, token) {
  const providerConfig = ensureConfig();
  const versionPath = sanitizeVersionPath(providerConfig.adeVersion ?? 'ade/1.0.0');
  const encodedId = encodeURIComponent(identifier);
  const path = versionPath
    ? `${versionPath}/consultarComprobante/${encodedId}`
    : `consultarComprobante/${encodedId}`;
  const url = buildUrl(path);

  try {
    const { data } = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: providerConfig.timeout,
    });

    return data;
  } catch (error) {
    handleAxiosError(error, 'Error consultando detalle del comprobante en Monroe');
  }
}

export default {
  login,
  fetchComprobantes,
  fetchComprobanteDetalle,
};
