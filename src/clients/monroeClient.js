import axios from 'axios';
import config from '../config/index.js';

/* =========================================
 * Utils de configuración y URL
 * ========================================= */
function ensureConfig() {
  const providerConfig = config.providers?.monroe ?? {};
  if (!providerConfig.baseUrl) {
    const err = new Error('MONROE_BASE_URL no está configurada');
    err.status = 500;
    throw err;
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
  const trimmed = String(versionPath || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
}

const DEBUG = String(process.env.MONROE_DEBUG || '').toLowerCase() === 'true';

function dlog(...args) {
  if (DEBUG) console.debug(...args);
}

/* =========================================
 * Helpers de fecha
 * ========================================= */
function isYYYYMMDD(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function toIsoZ(d) {
  if (isYYYYMMDD(d)) return `${d}T00:00:00.000Z`;
  return d;
}

function toYmdHms(d) {
  if (isYYYYMMDD(d)) return `${d} 00:00:00`;
  return d;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj ?? {}));
}

/* =========================================
 * Manejo de errores
 * ========================================= */
function normalizeErrorMessage(message, fallbackMessage) {
  if (message == null) return fallbackMessage;

  if (typeof message === 'string') {
    const t = message.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t);
        if (parsed && typeof parsed === 'object') {
          return normalizeErrorMessage(parsed, fallbackMessage);
        }
      } catch (_) { /* ignore */ }
    }
    return message;
  }

  if (typeof message === 'object') {
    const keys = ['description', 'mensaje', 'message', 'error'];
    const got = keys.map(k => message?.[k]).find(v => typeof v === 'string' && v.trim());
    if (got) return got;
    try { return JSON.stringify(message); } catch { return String(message); }
  }

  return String(message);
}

function handleAxiosError(error, fallbackMessage) {
  const message =
    error.response?.data?.mensaje ??
    error.response?.data?.error ??
    error.response?.data?.message ??
    error.message;
  const err = new Error(normalizeErrorMessage(message, fallbackMessage));
  err.status = error.response?.status || 502;
  err.cause = error;
  throw err;
}

/* =========================================
 * Auth
 * ========================================= */
export async function login(credentials) {
  const providerConfig = ensureConfig();
  const url = buildUrl('Auth/login');

  const params = { software_key: credentials.softwareKey };
  if (credentials.customerKey) params.ecommerce_customer_key = credentials.customerKey;
  if (credentials.customerReference) params.ecommerce_customer_reference = credentials.customerReference;
  if (Number.isFinite(credentials.tokenDuration)) params.token_duration = credentials.tokenDuration;

  // Intento principal: POST (como indica la doc)
  try {
    if (DEBUG) {
      const masked = {
        software_key: String(params.software_key || '').slice(0, 4) + '…',
        ecommerce_customer_key: params.ecommerce_customer_key ? 'SET' : '—',
        ecommerce_customer_reference: params.ecommerce_customer_reference || '—',
        token_duration: params.token_duration ?? '—',
      };
      dlog('[MONROE] LOGIN POST →', url, masked);
    }

    const { data } = await axios.post(url, null, {
      params,
      timeout: providerConfig.timeout,
    });

    if (DEBUG) {
      dlog('[MONROE] LOGIN OK expire_in:', data?.expire_in, 'session_id:', data?.session_id);
    }
    return data;
  } catch (postErr) {
    // Si el entorno de homologación tuviera alguna restricción, probamos GET
    const status = postErr?.response?.status;
    if (DEBUG && postErr?.response) {
      dlog('[MONROE] LOGIN POST FAIL STATUS:', status);
      dlog('[MONROE] LOGIN POST FAIL BODY:', postErr.response.data);
    }

    try {
      dlog('[MONROE] LOGIN GET fallback →', url);
      const { data } = await axios.get(url, {
        params,
        timeout: providerConfig.timeout,
      });
      if (DEBUG) {
        dlog('[MONROE] LOGIN GET OK expire_in:', data?.expire_in, 'session_id:', data?.session_id);
      }
      return data;
    } catch (getErr) {
      if (DEBUG && getErr?.response) {
        dlog('[MONROE] LOGIN GET FAIL STATUS:', getErr.response.status);
        dlog('[MONROE] LOGIN GET FAIL BODY:', getErr.response.data);
      }
      handleAxiosError(getErr, 'Error autenticando contra Monroe');
    }
  }
}

/* =========================================
 * Query helpers (camelCase, como te funcionaba)
 * ========================================= */
function buildCamelQuery(params = {}) {
  const out = {};
  if (params.fechaDesde) out.fechaDesde = params.fechaDesde;
  if (params.fechaHasta) out.fechaHasta = params.fechaHasta;
  if (params.nro_comprobante) out.nroComprobante = String(params.nro_comprobante).trim();
  if (params.tipo) out.tipo = String(params.tipo).trim();
  if (params.letra) out.letra = String(params.letra).trim();
  return out;
}

/* =========================================
 * Listado de comprobantes
 * ========================================= */
async function requestComprobantes(url, query, token, timeout, label) {

  const { data } = await axios.get(url, {
    params: query,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    timeout,
  });
  return data;
}

export async function fetchComprobantes(params, token) {
  const providerConfig = ensureConfig();
  const versionPath = sanitizeVersionPath(providerConfig.adeVersion ?? 'ade/1.0.0');

  // Query base camelCase
  const qBase = buildCamelQuery(params);

  // 1) Intento con formato ISO (YYYY-MM-DDT00:00:00.000Z si venían YYYY-MM-DD)
  const qIso = clone(qBase);
  if (qIso.fechaDesde) qIso.fechaDesde = toIsoZ(qIso.fechaDesde);
  if (qIso.fechaHasta) qIso.fechaHasta = toIsoZ(qIso.fechaHasta);

  const urlMain = buildUrl(versionPath ? `${versionPath}/consultarComprobantes` : 'consultarComprobantes');

  try {
    return await requestComprobantes(urlMain, qIso, token, providerConfig.timeout, 'ISO');
  } catch (errIso) {
    if (DEBUG && errIso.response) {
      dlog('[MONROE] ISO FAIL STATUS:', errIso.response.status);
      dlog('[MONROE] ISO FAIL BODY:', errIso.response.data);
    }

    // Si no es el clásico MdPre-VP-1 (validación de parámetros), devolvemos
    const msg = (errIso.response?.data?.mensaje || '').toString();
    const isMdPre = /MdPre-?VP-?1/i.test(msg);
    const status = errIso.response?.status;

    if (!isMdPre) {
      // Si el endpoint no existe (404/405), probamos fallback /comprobantes (algunos ADE lo exponen así)
      if (status === 404 || status === 405) {
        try {
          const urlAlt = buildUrl(versionPath ? `${versionPath}/comprobantes` : 'comprobantes');
          dlog('[MONROE] Fallback endpoint → /comprobantes (ISO)');
          return await requestComprobantes(urlAlt, qIso, token, providerConfig.timeout, 'ISO (fallback endpoint)');
        } catch (errAlt) {
          if (DEBUG && errAlt.response) {
            dlog('[MONROE] ALT ENDPOINT FAIL STATUS:', errAlt.response.status);
            dlog('[MONROE] ALT ENDPOINT FAIL BODY:', errAlt.response.data);
          }
          handleAxiosError(errIso, 'Error consultando comprobantes en Monroe');
        }
      }
      handleAxiosError(errIso, 'Error consultando comprobantes en Monroe');
    }

    // 2) Fallback de formato: YYYY-MM-DD 00:00:00
    const qHms = clone(qBase);
    if (qHms.fechaDesde) qHms.fechaDesde = toYmdHms(qHms.fechaDesde);
    if (qHms.fechaHasta) qHms.fechaHasta = toYmdHms(qHms.fechaHasta);

    dlog('[MONROE] Reintento con formato fecha YYYY-MM-DD 00:00:00 (HMS)');
    try {
      return await requestComprobantes(urlMain, qHms, token, providerConfig.timeout, 'HMS');
    } catch (errHms) {
      if (DEBUG && errHms.response) {
        dlog('[MONROE] HMS FAIL STATUS:', errHms.response.status);
        dlog('[MONROE] HMS FAIL BODY:', errHms.response.data);
      }

      const status2 = errHms.response?.status;
      // Si también falla y es porque el endpoint no existe en este host, probamos /comprobantes
      if (status2 === 404 || status2 === 405) {
        try {
          const urlAlt = buildUrl(versionPath ? `${versionPath}/comprobantes` : 'comprobantes');
          dlog('[MONROE] Fallback endpoint → /comprobantes (HMS)');
          return await requestComprobantes(urlAlt, qHms, token, providerConfig.timeout, 'HMS (fallback endpoint)');
        } catch (errAlt2) {
          if (DEBUG && errAlt2.response) {
            dlog('[MONROE] ALT ENDPOINT HMS FAIL STATUS:', errAlt2.response.status);
            dlog('[MONROE] ALT ENDPOINT HMS FAIL BODY:', errAlt2.response.data);
          }
        }
      }

      handleAxiosError(errHms, 'Error consultando comprobantes en Monroe (formato/endpoint)');
    }
  }
}

/* =========================================
 * Detalle de comprobante
 * ========================================= */
export async function fetchComprobanteDetalle(identifier, token) {
  const providerConfig = ensureConfig();
  const versionPath = sanitizeVersionPath(providerConfig.adeVersion ?? 'ade/1.0.0');

  // Endpoint principal documentado
  const primaryPath = versionPath
    ? `${versionPath}/consultarComprobante/${encodeURIComponent(identifier)}`
    : `consultarComprobante/${encodeURIComponent(identifier)}`;
  const urlPrimary = buildUrl(primaryPath);

  dlog('[MONROE] GET detalle →', urlPrimary);

  try {
    const { data } = await axios.get(urlPrimary, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      timeout: providerConfig.timeout,
    });
    return data;
  } catch (errPrimary) {
    const status = errPrimary.response?.status;
    if (DEBUG && errPrimary.response) {
      dlog('[MONROE] DETALLE FAIL STATUS:', status);
      dlog('[MONROE] DETALLE FAIL BODY:', errPrimary.response.data);
    }

    // Fallback si en este host la ruta es /comprobantes/:id
    if (status === 404 || status === 405) {
      const altPath = versionPath
        ? `${versionPath}/comprobantes/${encodeURIComponent(identifier)}`
        : `comprobantes/${encodeURIComponent(identifier)}`;
      const urlAlt = buildUrl(altPath);
      dlog('[MONROE] DETALLE fallback →', urlAlt);

      try {
        const { data } = await axios.get(urlAlt, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          timeout: providerConfig.timeout,
        });
        return data;
      } catch (errAlt) {
        if (DEBUG && errAlt.response) {
          dlog('[MONROE] DETALLE ALT FAIL STATUS:', errAlt.response.status);
          dlog('[MONROE] DETALLE ALT FAIL BODY:', errAlt.response.data);
        }
        handleAxiosError(errPrimary, 'Error consultando detalle del comprobante en Monroe');
      }
    }

    handleAxiosError(errPrimary, 'Error consultando detalle del comprobante en Monroe');
  }
}

/* =========================================
 * Export
 * ========================================= */
export default {
  login,
  fetchComprobantes,
  fetchComprobanteDetalle,
};
