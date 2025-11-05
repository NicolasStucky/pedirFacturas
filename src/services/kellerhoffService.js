import config from '../config/index.js';
import { fetchProducts, login } from '../clients/kellerhoffClient.js';

const tokenCache = new Map();

function normalizeString(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireString(value, name) {
  const normalized = normalizeString(value);
  if (normalized) return normalized;
  const error = new Error(`Debe indicar ${name} mediante el cuerpo de la petición o variables de entorno`);
  error.status = 400;
  throw error;
}

function parsePositiveInteger(value, name) {
  if (value == null || value === '') {
    return undefined;
  }

  const normalized = typeof value === 'string' ? value.replace(/\s+/g, '') : value;
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    const error = new Error(`${name} debe ser un número entero mayor a 0`);
    error.status = 400;
    throw error;
  }

  return Math.trunc(parsed);
}

function extractToken(response) {
  if (!response) return undefined;

  if (typeof response === 'string') {
    return response.trim();
  }

  const candidates = [
    response.token,
    response.access_token,
    response.accessToken,
    response.Authorization,
    response.data?.token,
    response.data?.access_token,
    response.data?.accessToken,
    response.data?.Authorization
  ];

  for (const candidate of candidates) {
    const normalized = normalizeString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function ensureSuccessfulResponse(response, fallbackMessage) {
  if (!response || typeof response !== 'object') {
    return;
  }

  if (response.status === false) {
    const error = new Error(response.message ?? fallbackMessage ?? 'Respuesta inválida del servicio Kellerhoff');
    error.status = 401;
    throw error;
  }
}

function computeExpiration(providerConfig, response) {
  const ttlSecondsCandidates = [
    response?.expires_in,
    response?.expiresIn,
    response?.data?.expires_in,
    response?.data?.expiresIn
  ]
    .map((value) => {
      const normalized = normalizeString(value);
      if (!normalized) return undefined;
      const parsed = Number(normalized);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    })
    .filter((value) => value != null);

  if (ttlSecondsCandidates.length > 0) {
    return Date.now() + Math.min(...ttlSecondsCandidates) * 1000 - 60000;
  }

  const ttlHours = Number.isFinite(providerConfig.tokenTtlHours)
    ? providerConfig.tokenTtlHours
    : 12;

  return Date.now() + ttlHours * 60 * 60 * 1000 - 60000;
}

async function getAccessToken(credentials) {
  const cacheKey = credentials.email;
  const cached = tokenCache.get(cacheKey);

  if (cached?.token && (!cached.expiresAt || cached.expiresAt > Date.now())) {
    return cached.token;
  }

  const response = await login(credentials);
  ensureSuccessfulResponse(response, 'Credenciales inválidas para Kellerhoff');

  const token = extractToken(response);

  if (!token) {
    const error = new Error('La autenticación de Kellerhoff no devolvió un token');
    error.status = 502;
    throw error;
  }

  const providerConfig = config.providers?.kellerhoff ?? {};
  const expiresAt = computeExpiration(providerConfig, response);

  tokenCache.set(cacheKey, {
    token,
    expiresAt
  });

  return token;
}

function sanitizeCredentials(credentials) {
  return {
    email: credentials.email
  };
}

function buildCredentials(body = {}, query = {}) {
  const providerConfig = config.providers?.kellerhoff ?? {};

  const email =
    normalizeString(body.email ?? query.email ?? providerConfig.email) ??
    requireString(undefined, 'email');

  const password =
    normalizeString(body.password ?? query.password ?? providerConfig.password) ??
    requireString(undefined, 'password');

  return { email, password };
}

function buildProductsPayload(body = {}) {
  const providerConfig = config.providers?.kellerhoff ?? {};

  const pharmacyInput = body.pharmacy && typeof body.pharmacy === 'object' ? body.pharmacy : {};

  const reference =
    parsePositiveInteger(pharmacyInput.reference, 'pharmacy.reference') ??
    parsePositiveInteger(providerConfig.pharmacyReference, 'pharmacy.reference');

  if (!Number.isFinite(reference)) {
    const error = new Error(
      'Debe indicar pharmacy.reference en el cuerpo de la petición o configurar KELLERHOFF_PHARMACY_REFERENCE'
    );
    error.status = 400;
    throw error;
  }

  if (!Array.isArray(body.products) || body.products.length === 0) {
    const error = new Error('Debe enviar un arreglo products con al menos un elemento');
    error.status = 400;
    throw error;
  }

  const products = body.products.map((item, index) => {
    const codebar = normalizeString(item?.codebar ?? item?.codigo_barra ?? item?.barcode);
    if (!codebar) {
      const error = new Error(`products[${index}].codebar es obligatorio`);
      error.status = 400;
      throw error;
    }

    const quantity = item?.quantity ?? item?.cantidad ?? 1;
    const parsedQuantity = parsePositiveInteger(quantity, `products[${index}].quantity`);

    return {
      codebar,
      quantity: parsedQuantity
    };
  });

  return {
    pharmacy: { reference },
    products
  };
}

export async function getKellerhoffProducts(body = {}, query = {}) {
  const credentials = buildCredentials(body, query);
  const payload = buildProductsPayload(body);
  const token = await getAccessToken(credentials);
  const response = await fetchProducts(payload, token);

  return {
    provider: 'kellerhoff',
    request: {
      pharmacy: payload.pharmacy,
      products: payload.products,
      credentials: sanitizeCredentials(credentials)
    },
    response
  };
}

export default {
  getKellerhoffProducts
};
