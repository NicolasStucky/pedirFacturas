import config from '../config/index.js';
import {
  fetchComprobanteDetalle,
  fetchComprobantes,
  login,
} from '../clients/monroeClient.js';
import { getBranchCredentials } from '../repositories/branchCredentialsRepository.js';
import {
  ensureMaxRange,
  getDefaultRange,
} from '../utils/isoDate.js';

const MAX_RANGE_DAYS = 6; // 7 días corridos incluyendo límites
const tokenCache = new Map();

function normalizeString(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseTokenDuration(value) {
  const normalized = normalizeString(value);
  if (!normalized) return undefined;
  const asNumber = Number(normalized);
  if (!Number.isFinite(asNumber) || asNumber <= 0) {
    const error = new Error('token_duration debe ser un número mayor a 0 (minutos)');
    error.status = 400;
    throw error;
  }
  return asNumber;
}

function buildCredentials(query = {}, branchCredentials) {
  const providerConfig = config.providers?.monroe ?? {};
  const branchMonroe = branchCredentials?.monroe ?? {};
  const softwareKey = normalizeString(
    query.software_key ??
      query.softwareKey ??
      branchMonroe.softwareKey ??
      providerConfig.softwareKey
  );

  if (!softwareKey) {
    const error = new Error(
      'Debe configurar MONROE_SOFTWARE_KEY o enviarla como software_key en la consulta'
    );
    error.status = 400;
    throw error;
  }

  const customerKey = normalizeString(
    query.ecommerce_customer_key ??
      query.customerKey ??
      branchMonroe.ecommerceKey ??
      providerConfig.customerKey
  );
  const customerReference = normalizeString(
    query.ecommerce_customer_reference ??
      query.customerReference ??
      branchMonroe.cuenta ??
      providerConfig.customerReference
  );
  const tokenDuration = parseTokenDuration(
    query.token_duration ??
      query.tokenDuration ??
      (providerConfig.tokenDurationMinutes != null
        ? String(providerConfig.tokenDurationMinutes)
        : undefined)
  );

  return {
    softwareKey,
    customerKey,
    customerReference,
    tokenDuration,
  };
}

function buildCacheKey(credentials) {
  return [
    credentials.softwareKey,
    credentials.customerKey ?? '',
    credentials.customerReference ?? '',
  ].join('::');
}

function parseExpireIn(expireIn) {
  const normalized = normalizeString(expireIn);
  if (!normalized) return null;

  const [datePart, timePart] = normalized.split(' ');
  if (!datePart || !timePart) return null;

  const [dayStr, monthStr, yearStr] = datePart.split('/');
  const [hourStr, minuteStr, secondStr] = timePart.split(':');

  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = Number(secondStr ?? 0);

  if (
    [day, month, year, hour, minute, second].some(
      (value) => !Number.isFinite(value)
    )
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day, hour, minute, second);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function computeExpiration(loginResponse, tokenDuration) {
  const parsed = parseExpireIn(loginResponse?.expire_in);
  if (parsed) return parsed;
  if (Number.isFinite(tokenDuration)) {
    return Date.now() + tokenDuration * 60 * 1000;
  }
  // Fallback: 25 minutos
  return Date.now() + 25 * 60 * 1000;
}

async function getAccessToken(credentials) {
  const cacheKey = buildCacheKey(credentials);
  const cached = tokenCache.get(cacheKey);

  if (cached?.token && (!cached.expiresAt || cached.expiresAt > Date.now())) {
    return cached.token;
  }

  const response = await login(credentials);
  const token = normalizeString(response?.access_token);

  if (!token) {
    const error = new Error('La autenticación de Monroe no devolvió access_token');
    error.status = 502;
    throw error;
  }

  const expiresAt = computeExpiration(response, credentials.tokenDuration);
  tokenCache.set(cacheKey, {
    token,
    expiresAt: expiresAt ? expiresAt - 5000 : undefined, // margen de seguridad
  });

  return token;
}

function sanitizeCredentials(credentials) {
  return {
    softwareKey: credentials.softwareKey,
    ...(credentials.customerKey ? { customerKey: credentials.customerKey } : {}),
    ...(credentials.customerReference
      ? { customerReference: credentials.customerReference }
      : {}),
    ...(credentials.tokenDuration
      ? { tokenDuration: credentials.tokenDuration }
      : {}),
  };
}

function buildComprobantesParams(query = {}) {
  const defaults = getDefaultRange(MAX_RANGE_DAYS);
  // Siempre consultamos las últimas 24 horas (día anterior a hoy) para Monroe.
  const fechaDesde = defaults.desde;
  const fechaHasta = defaults.hasta;

  ensureMaxRange(fechaDesde, fechaHasta, MAX_RANGE_DAYS);

  const params = {
    fechaDesde,
    fechaHasta,
  };

  const nroComprobante = normalizeString(
    query.nro_comprobante ?? query.nroComprobante
  );
  if (nroComprobante) {
    params.nro_comprobante = nroComprobante;
  }

  const tipo = normalizeString(query.tipo);
  if (tipo) {
    params.tipo = tipo;
  }

  const letra = normalizeString(query.letra);
  if (letra) {
    params.letra = letra;
  }

  return params;
}

export async function getMonroeComprobantes(branchCode, query = {}) {
  const branchCredentials = await getBranchCredentials(branchCode);
  const credentials = buildCredentials(query, branchCredentials);
  const params = buildComprobantesParams(query);
  const token = await getAccessToken(credentials);
  const response = await fetchComprobantes(params, token);

  return {
    provider: 'monroe',
    branch: branchCredentials.branchCode,
    request: {
      params,
      credentials: sanitizeCredentials(credentials),
    },
    response,
  };
}

export async function getMonroeComprobanteDetalle(branchCode, comprobanteId, query = {}) {
  const identifier = normalizeString(comprobanteId);
  if (!identifier) {
    const error = new Error(
      'Debe indicar el identificador del comprobante en la ruta (por ejemplo FC-A-0001-00000001)'
    );
    error.status = 400;
    throw error;
  }

  const branchCredentials = await getBranchCredentials(branchCode);
  const credentials = buildCredentials(query, branchCredentials);
  const token = await getAccessToken(credentials);
  const response = await fetchComprobanteDetalle(identifier, token);

  return {
    provider: 'monroe',
    branch: branchCredentials.branchCode,
    request: {
      comprobanteId: identifier,
      credentials: sanitizeCredentials(credentials),
    },
    response,
  };
}

export default {
  getMonroeComprobantes,
  getMonroeComprobanteDetalle,
};
