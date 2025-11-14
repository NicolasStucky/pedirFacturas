import config from '../config/index.js';
import {
  fetchComprobanteDetalle,
  fetchComprobantes,
  login,
} from '../clients/monroeClient.js';
import {
  getBranchCredentials,
  listMonroeBranches,
} from '../repositories/branchCredentialsRepository.js';
import {
  listStoredMonroeComprobantes,
  replaceAllMonroeComprobantes,
} from '../repositories/monroeComprobantesRepository.js';
import {
  ensureMaxRange,
  formatToISODate,
  parseISO8601,
} from '../utils/isoDate.js';

const MAX_RANGE_DAYS = 6; // política Monroe
const CABECERA_DEFAULT_START = '2025-10-01';

function getDefaultRange() {
  const referenceDate = parseISO8601(formatToISODate(new Date()));
  const lastAvailable = addUtcDays(referenceDate, -1);

  const inclusiveSpan = Math.max(0, MAX_RANGE_DAYS - 1);
  const start = addUtcDays(lastAvailable, -inclusiveSpan);

  return {
    desde: formatToISODate(start),
    hasta: formatToISODate(lastAvailable),
  };
}

const DD_MM_YYYY_REGEX =
  /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/;

function hasExplicitRange(query = {}) {
  return [
    query.fechaDesde,
    query.fechaHasta,
    query.desde,
    query.hasta,
    query.from,
    query.to,
  ].some((value) => typeof value === 'string' && value.trim().length > 0);
}

function normalizeToIsoDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    try {
      return formatToISODate(value);
    } catch (_) {
      return null;
    }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const match = trimmed.match(DD_MM_YYYY_REGEX);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }

    try {
      return formatToISODate(trimmed);
    } catch (_) {
      return null;
    }
  }

  try {
    return formatToISODate(value);
  } catch (_) {
    return null;
  }
}

function addUtcDays(date, amount) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + amount);
  return copy;
}

function computeNextRangeStart(storedItems = []) {
  let latest = null;

  for (const item of storedItems) {
    const normalized = normalizeToIsoDate(item?.fecha);
    if (!normalized) continue;
    const parsed = parseISO8601(normalized);
    if (!latest || parsed > latest) {
      latest = parsed;
    }
  }

  if (!latest) {
    return parseISO8601(getDefaultRange().desde);
  }

  return addUtcDays(latest, 1);
}

function generateSequentialRanges(startDate) {
  const today = parseISO8601(formatToISODate(new Date()));
  const lastAvailable = addUtcDays(today, -1);
  if (startDate > lastAvailable) return [];

  const ranges = [];
  let currentStart = new Date(startDate.getTime());

  while (currentStart <= lastAvailable) {
    // El rango debe abarcar exactamente MAX_RANGE_DAYS días corridos.
    const inclusiveSpan = Math.max(0, MAX_RANGE_DAYS - 1);
    let currentEnd = addUtcDays(currentStart, inclusiveSpan);
    if (currentEnd > lastAvailable) {
      currentEnd = lastAvailable;
    }

    ranges.push({
      desde: formatToISODate(currentStart),
      hasta: formatToISODate(currentEnd),
    });

    currentStart = addUtcDays(currentEnd, 1);
  }

  return ranges;
}

function mergeSlimEntries(existing = [], additions = []) {
  const map = new Map();

  for (const entry of existing) {
    const key = [
      entry?.customer_reference ?? '',
      entry?.fecha ?? '',
      entry?.codigo_busqueda ?? '',
    ].join('::');
    map.set(key, {
      customer_reference: entry?.customer_reference ?? null,
      fecha: entry?.fecha ?? null,
      codigo_busqueda: entry?.codigo_busqueda ?? null,
    });
  }

  for (const entry of additions) {
    const key = [
      entry?.customer_reference ?? '',
      entry?.fecha ?? '',
      entry?.codigo_busqueda ?? '',
    ].join('::');
    map.set(key, {
      customer_reference: entry?.customer_reference ?? null,
      fecha: entry?.fecha ?? null,
      codigo_busqueda: entry?.codigo_busqueda ?? null,
    });
  }

  return Array.from(map.values());
}

/**
 * Cache de tokens por combinación de credenciales.
 * Guardamos { token, expiresAt } para evitar logins innecesarios.
 */
const tokenCache = new Map();

/* ============================
 * Helpers básicos
 * ============================ */
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

  // Para servicios de comprobantes (requieren contexto de cliente)
  if (!customerKey || !customerReference) {
    const error = new Error('Credenciales incompletas para Monroe: faltan ecommerce_customer_key y/o ecommerce_customer_reference');
    error.status = 400;
    throw error;
  }

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

/**
 * ADE devuelve "expire_in" como "DD/MM/YYYY HH:mm:ss".
 * Si no viene, usamos la duración pedida (o 25 min por defecto).
 */
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

  if ([day, month, year, hour, minute, second].some(v => !Number.isFinite(v))) {
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
  // Fallback 25 minutos
  return Date.now() + 25 * 60 * 1000;
}

/* ============================
 * Gestión del token (activación + refresh con retry)
 * ============================ */
function invalidateToken(credentials) {
  tokenCache.delete(buildCacheKey(credentials));
}

async function getAccessToken(credentials, { forceRefresh = false } = {}) {
  const cacheKey = buildCacheKey(credentials);
  const cached = tokenCache.get(cacheKey);

  if (!forceRefresh && cached?.token && (!cached.expiresAt || cached.expiresAt > Date.now())) {
    return cached.token;
  }

  // "Activar" / loguear como indica la doc: /Auth/login con las credenciales
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
    // margen de 5s para evitar carreras
    expiresAt: expiresAt ? expiresAt - 5000 : undefined,
  });

  return token;
}

/** Fuerza la activación del token antes de llamar cualquier servicio. */
async function activateToken(credentials) {
  return await getAccessToken(credentials, { forceRefresh: true });
}

/**
 * Ejecuta una función que llama a la API Monroe y, si obtiene 401,
 * invalida el token, re-loguea y reintenta 1 sola vez.
 *
 * EXTRA: si refreshFirst === true, fuerza activar/refrescar el token ANTES
 * de la primera llamada (caso “apenas entro a la ruta”).
 */
async function withMonroeAuthRetry(credentials, fn, { refreshFirst = false } = {}) {
  const override = process.env.MONROE_BEARER_OVERRIDE?.trim();
  if (override) {
    if (process.env.MONROE_DEBUG === 'true') {
      console.debug('[MONROE] Using MONROE_BEARER_OVERRIDE (first 12 chars):', override.slice(0, 12) + '…');
    }
    return await fn(override);
  }

  let token;
  if (refreshFirst) {
    // Fuerza activación de token al entrar
    token = await activateToken(credentials);
  } else {
    token = await getAccessToken(credentials);
  }

  try {
    return await fn(token);
  } catch (err) {
    const status = err?.status || err?.cause?.response?.status;
    const body = err?.cause?.response?.data ?? {};
    const msg = [(err?.message || ''), body?.mensaje, body?.message, body?.error?.description, body?.error]
      .filter(Boolean).join(' ');
    const isUnauthorized =
      status === 401 ||
      /unauthorized/i.test(msg) ||
      /\bAPI-cli-1\b/i.test(msg) ||
      /\bAPI-cli-2\.2\b/i.test(msg);
    if (!isUnauthorized) throw err;

    // Invalida y reintenta 1 vez
    invalidateToken(credentials);
    token = await getAccessToken(credentials, { forceRefresh: true });
    return await fn(token);
  }
}

/* ============================
 * Sanitización para respuesta
 * ============================ */
function sanitizeCredentials(credentials) {
  return {
    softwareKey: credentials.softwareKey,
    ...(credentials.customerKey ? { customerKey: credentials.customerKey } : {}),
    ...(credentials.customerReference ? { customerReference: credentials.customerReference } : {}),
    ...(credentials.tokenDuration ? { tokenDuration: credentials.tokenDuration } : {}),
  };
}

/* ============================
 * Parámetros de consulta
 * ============================ */
function buildComprobantesParams(query = {}, defaults = getDefaultRange()) {
  
  // tomar de la query si vienen; si no, usar defaults
  const fechaDesde = normalizeString(
    query.fechaDesde ?? query.desde ?? query.from
  ) ?? defaults.desde;

  const fechaHasta = normalizeString(
    query.fechaHasta ?? query.hasta ?? query.to
  ) ?? defaults.hasta;

  // valida rango máximo permitido
  ensureMaxRange(fechaDesde, fechaHasta, MAX_RANGE_DAYS, { enforceRecency: false });

  const params = { fechaDesde, fechaHasta };

  const nroComprobante = normalizeString(query.nro_comprobante ?? query.nroComprobante);
  if (nroComprobante) params.nro_comprobante = nroComprobante;

  const tipo = normalizeString(query.tipo);
  if (tipo) params.tipo = tipo;

  const letra = normalizeString(query.letra);
  if (letra) params.letra = letra;

  return params;
}

function mapComprobantesToSlim(full) {
  const customerRef = full?.request?.credentials?.customerReference ?? null;
  const items = Array.isArray(full?.response?.Comprobantes)
    ? full.response.Comprobantes
    : [];

  return items.map((it) => {
    const cab = it?.Comprobante?.Cabecera ?? it?.Cabecera ?? {};
    return {
      customer_reference: customerRef,
      fecha: normalizeToIsoDate(cab?.fecha) ?? null,
      codigo_busqueda: cab?.codigo_busqueda ?? cab?.codigoBusqueda ?? null,
    };
  });
}

function mapComprobantesToIdentifiers(full) {
  const items = Array.isArray(full?.response?.Comprobantes)
    ? full.response.Comprobantes
    : [];

  const seen = new Set();

  return items
    .map((it) => {
      const cab = it?.Comprobante?.Cabecera ?? it?.Cabecera ?? {};
      return (
        normalizeString(cab?.codigo_busqueda ?? cab?.codigoBusqueda ?? cab?.codigo) ||
        null
      );
    })
    .filter((identifier) => {
      if (!identifier) return false;
      if (seen.has(identifier)) return false;
      seen.add(identifier);
      return true;
    });
}

/* ============================
 * Casos públicos del servicio
 * ============================ */
async function fetchComprobantesForBranch(branchCredentials, query = {}, { preactivate = false } = {}) {
  const credentials = buildCredentials(query, branchCredentials);
  const params = buildComprobantesParams(query);

  if (preactivate) {
    // La documentación indica que primero debemos activar el token contra Auth/login
    await activateToken(credentials);
  }

  const response = await withMonroeAuthRetry(
    credentials,
    async (token) => {
      return await fetchComprobantes(params, token);
    },
    {
      // Si ya activamos el token manualmente, evitamos pedir refresh inicial duplicado
      refreshFirst: !preactivate,
    }
  );

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

async function fetchComprobanteDetalleForBranch(branchCredentials, comprobanteId, query = {}) {
  const identifier = normalizeString(comprobanteId);
  if (!identifier) {
    const error = new Error(
      'Debe indicar el identificador del comprobante en la ruta (por ejemplo FC-A-0001-00000001)'
    );
    error.status = 400;
    throw error;
  }

  const credentials = buildCredentials(query, branchCredentials);

  const response = await withMonroeAuthRetry(
    credentials,
    async (token) => {
      return await fetchComprobanteDetalle(identifier, token);
    },
    { refreshFirst: true }
  );

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

export async function getMonroeComprobantes(branchCode, query = {}) {
  const branchCredentials = await getBranchCredentials(branchCode);
  return await fetchComprobantesForBranch(branchCredentials, query, { preactivate: false });
}

export async function getMonroeComprobantesSlim(branchCode, query = {}) {
  const full = await getMonroeComprobantes(branchCode, query);
  return {
    provider: 'monroe',
    branch: full.branch,
    data: mapComprobantesToSlim(full),
  };
}

export async function getMonroeComprobantesForAllBranches(query = {}) {
  const branches = await listMonroeBranches();
  const results = [];
  const skipped = [];

  const useCustomRange = hasExplicitRange(query) || normalizeString(query.nro_comprobante ?? query.nroComprobante);
  let storedSlim = [];
  let generatedRanges = [];

  if (!useCustomRange) {
    storedSlim = await listStoredMonroeComprobantes();
    const nextStart = computeNextRangeStart(storedSlim);
    generatedRanges = generateSequentialRanges(nextStart);
    if (generatedRanges.length === 0) {
      return { results: [], skipped };
    }
  }

  for (const branch of branches) {
    const branchCredentials = await getBranchCredentials(branch);
    try {
      if (useCustomRange) {
        const full = await fetchComprobantesForBranch(branchCredentials, query, { preactivate: true });
        results.push({
          provider: 'monroe',
          branch: full.branch,
          data: mapComprobantesToSlim(full),
        });
      } else {
        const aggregated = [];
        for (let index = 0; index < generatedRanges.length; index += 1) {
          const range = generatedRanges[index];
          const rangeQuery = {
            ...query,
            fechaDesde: range.desde,
            fechaHasta: range.hasta,
          };
          const full = await fetchComprobantesForBranch(
            branchCredentials,
            rangeQuery,
            { preactivate: index === 0 }
          );
          aggregated.push(...mapComprobantesToSlim(full));
        }

        results.push({
          provider: 'monroe',
          branch,
          data: mergeSlimEntries([], aggregated),
        });
      }
    } catch (e) {
      const status = e?.status || e?.cause?.response?.status;
      const body = e?.cause?.response?.data ?? {};
      const reason = [(e?.message || ''), body?.mensaje, body?.message, body?.error?.description].filter(Boolean).join(' ');
      // Omitimos sucursales con credenciales incompletas o rechazo de autorización
      if (
        status === 401 ||
        /API-cli-2\.2/i.test(reason) ||
        /Credenciales incompletas/i.test(reason)
      ) {
        skipped.push({ branch, reason });
        continue;
      }
      throw e; // otros errores sí rompen
    }
  }

  if (useCustomRange) {
    await replaceAllMonroeComprobantes(results);
  } else {
    const combined = mergeSlimEntries(
      storedSlim,
      results.flatMap((result) => result.data ?? [])
    );

    if (combined.length > 0) {
      await replaceAllMonroeComprobantes([
        { provider: 'monroe', branch: null, data: combined },
      ]);
    }
  }

  return { results, skipped };
}

export async function getMonroeComprobanteDetalle(branchCode, comprobanteId, query = {}) {
  const branchCredentials = await getBranchCredentials(branchCode);
  return await fetchComprobanteDetalleForBranch(branchCredentials, comprobanteId, query);
}

export async function getMonroeCabecerasForAllBranches(query = {}) {
  const branches = await listMonroeBranches();
  const results = [];
  const skipped = [];

  const useCustomRange =
    hasExplicitRange(query) || normalizeString(query.nro_comprobante ?? query.nroComprobante);

  const sequentialStart = useCustomRange ? null : parseISO8601(CABECERA_DEFAULT_START);
  const sequentialRanges = useCustomRange ? [] : generateSequentialRanges(sequentialStart);

  for (const branch of branches) {
    const branchCredentials = await getBranchCredentials(branch);

    try {
      if (useCustomRange) {
        const full = await fetchComprobantesForBranch(branchCredentials, query, { preactivate: true });
        const identifiers = mapComprobantesToIdentifiers(full);
        const slimEntries = mapComprobantesToSlim(full);
        const identifierToCustomerReference = new Map();

        for (const entry of slimEntries) {
          const identifier = normalizeString(entry?.codigo_busqueda);
          const customerRef = entry?.customer_reference ?? null;
          if (!identifier) continue;
          if (customerRef == null) continue;
          if (!identifierToCustomerReference.has(identifier)) {
            identifierToCustomerReference.set(identifier, customerRef);
          }
        }

        const branchData = [];

        for (const identifier of identifiers) {
          try {
            const detailFull = await fetchComprobanteDetalleForBranch(
              branchCredentials,
              identifier,
              query
            );

            const customerReference =
              (identifier && identifierToCustomerReference.get(identifier)) ??
              slimEntries.find(
                (entry) => normalizeString(entry?.codigo_busqueda) === normalizeString(identifier)
              )?.customer_reference ??
              full?.request?.credentials?.customerReference ??
              null;

            branchData.push({
              comprobanteId: identifier,
              customerReference,
              full: detailFull,
            });
          } catch (detailError) {
            const status = detailError?.status || detailError?.cause?.response?.status;
            const body = detailError?.cause?.response?.data ?? {};
            const reason = [
              detailError?.message || '',
              body?.mensaje,
              body?.message,
              body?.error?.description,
            ]
              .filter(Boolean)
              .join(' ');

            skipped.push({
              branch: branchCredentials.branchCode,
              comprobante: identifier,
              reason: reason || undefined,
              status: status || undefined,
            });
          }
        }

        results.push({
          provider: 'monroe',
          branch: branchCredentials.branchCode,
          data: branchData,
        });
        continue;
      }

      if (sequentialRanges.length === 0) {
        results.push({
          provider: 'monroe',
          branch: branchCredentials.branchCode,
          data: [],
        });
        continue;
      }

      let firstFull = null;
      const identifiers = [];
      const seenIdentifiers = new Set();
      const slimEntries = [];
      const identifierToCustomerReference = new Map();

      for (let index = 0; index < sequentialRanges.length; index += 1) {
        const range = sequentialRanges[index];
        const rangeQuery = {
          ...query,
          fechaDesde: range.desde,
          fechaHasta: range.hasta,
        };

        const full = await fetchComprobantesForBranch(
          branchCredentials,
          rangeQuery,
          { preactivate: index === 0 }
        );

        if (!firstFull) {
          firstFull = full;
        }

        const rangeIdentifiers = mapComprobantesToIdentifiers(full);
        for (const identifier of rangeIdentifiers) {
          if (!seenIdentifiers.has(identifier)) {
            seenIdentifiers.add(identifier);
            identifiers.push(identifier);
          }
        }

        const rangeSlimEntries = mapComprobantesToSlim(full);
        slimEntries.push(...rangeSlimEntries);

        for (const entry of rangeSlimEntries) {
          const identifier = normalizeString(entry?.codigo_busqueda);
          const customerRef = entry?.customer_reference ?? null;
          if (!identifier) continue;
          if (customerRef == null) continue;
          if (!identifierToCustomerReference.has(identifier)) {
            identifierToCustomerReference.set(identifier, customerRef);
          }
        }
      }

      const branchData = [];

      for (const identifier of identifiers) {
        try {
          const detailFull = await fetchComprobanteDetalleForBranch(
            branchCredentials,
            identifier,
            query
          );

          const normalizedIdentifier = normalizeString(identifier);
          const customerReference =
            (normalizedIdentifier && identifierToCustomerReference.get(normalizedIdentifier)) ??
            slimEntries.find(
              (entry) => normalizeString(entry?.codigo_busqueda) === normalizedIdentifier
            )?.customer_reference ??
            firstFull?.request?.credentials?.customerReference ??
            null;

          branchData.push({
            comprobanteId: identifier,
            customerReference,
            full: detailFull,
          });
        } catch (detailError) {
          const status = detailError?.status || detailError?.cause?.response?.status;
          const body = detailError?.cause?.response?.data ?? {};
          const reason = [
            detailError?.message || '',
            body?.mensaje,
            body?.message,
            body?.error?.description,
          ]
            .filter(Boolean)
            .join(' ');

          skipped.push({
            branch: branchCredentials.branchCode,
            comprobante: identifier,
            reason: reason || undefined,
            status: status || undefined,
          });
        }
      }

      results.push({
        provider: 'monroe',
        branch: branchCredentials.branchCode,
        data: branchData,
      });
    } catch (e) {
      const status = e?.status || e?.cause?.response?.status;
      const body = e?.cause?.response?.data ?? {};
      const reason = [
        e?.message || '',
        body?.mensaje,
        body?.message,
        body?.error?.description,
      ]
        .filter(Boolean)
        .join(' ');

      if (
        status === 401 ||
        /API-cli-2\.2/i.test(reason) ||
        /Credenciales incompletas/i.test(reason)
      ) {
        skipped.push({ branch: branchCredentials.branchCode, reason: reason || undefined, status });
        continue;
      }

      throw e;
    }
  }

  return { results, skipped };
}

/** 🔎 Diagnóstico: prueba /Auth/login con las credenciales resultantes y devuelve datos útiles. */
export async function monroeLoginProbe(branchCode, query = {}) {
  const { getBranchCredentials } = await import('../repositories/branchCredentialsRepository.js');
  const { login } = await import('../clients/monroeClient.js');
  const { default: config } = await import('../config/index.js');

  const branchCredentials = await getBranchCredentials(branchCode);

  // Armamos credenciales igual que para los otros métodos
  const softwareKey =
    query.software_key ??
    query.softwareKey ??
    branchCredentials?.monroe?.softwareKey ??
    config.providers?.monroe?.softwareKey;

  const customerKey =
    query.ecommerce_customer_key ??
    query.customerKey ??
    branchCredentials?.monroe?.ecommerceKey ??
    config.providers?.monroe?.customerKey;

  const customerReference =
    query.ecommerce_customer_reference ??
    query.customerReference ??
    branchCredentials?.monroe?.cuenta ??
    config.providers?.monroe?.customerReference;

  const tokenDuration = Number(query.token_duration ?? config.providers?.monroe?.tokenDurationMinutes ?? 30);

  const creds = {
    softwareKey,
    customerKey,
    customerReference,
    tokenDuration
  };

  const loginResp = await login(creds);

  return {
    provider: 'monroe',
    branch: branchCode,
    baseUrl: config.providers?.monroe?.baseUrl,
    adeVersion: config.providers?.monroe?.adeVersion,
    credentialsUsed: creds,
    login: {
      hasAccessToken: !!loginResp?.access_token,
      tokenType: loginResp?.token_type ?? null,
      expireIn: loginResp?.expire_in ?? null,
      sessionId: loginResp?.session_id ?? null
    }
  };
}

export default {
  getMonroeComprobantes,
  getMonroeComprobanteDetalle,
  getMonroeCabecerasForAllBranches,
  getMonroeComprobantesSlim,
  getMonroeComprobantesForAllBranches,
  monroeLoginProbe,
};
