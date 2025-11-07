import config from '../config/index.js';
import { fetchComprobantes } from '../clients/cofarsurClient.js';
import { ensureMaxRange, getDefaultRange } from '../utils/date.js';
import { getBranchCredentials } from '../repositories/branchCredentialsRepository.js';

function resolveDate(key, query, defaults) {
  const direct = query[key];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  const camel = query[camelKey];
  if (typeof camel === 'string' && camel.trim()) return camel.trim();

  if (key === 'fecha_desde') return defaults.desde;
  if (key === 'fecha_hasta') return defaults.hasta;
  return undefined;
}

function requireCredential(value, name, branchCode) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  const suffix = branchCode ? ` para la sucursal ${branchCode}` : '';
  const error = new Error(
    `Debe indicar ${name}${suffix} mediante la base de credenciales o enviarlo en la query`
  );
  error.status = 400;
  throw error;
}

function buildPayload(branchCredentials, query) {
  const providerConfig = config.providers?.cofarsur ?? {};
  const branchCofarsur = branchCredentials?.cofarsur ?? {};
  const maxRangeDays = Number.isFinite(providerConfig.maxRangeDays)
    ? providerConfig.maxRangeDays
    : 6;

  const defaults = getDefaultRange(maxRangeDays);

  const fecha_desde = resolveDate('fecha_desde', query, defaults);
  const fecha_hasta = resolveDate('fecha_hasta', query, defaults);

  ensureMaxRange(fecha_desde, fecha_hasta, maxRangeDays);

  const usuario = requireCredential(
    query.usuario ?? branchCofarsur.usuario ?? providerConfig.usuario,
    'usuario',
    branchCredentials.branchCode
  );
  const clave = requireCredential(
    query.clave ?? branchCofarsur.clave ?? providerConfig.clave,
    'clave',
    branchCredentials.branchCode
  );
  const token = requireCredential(
    query.token ?? branchCofarsur.token ?? providerConfig.token,
    'token',
    branchCredentials.branchCode
  );

  return {
    usuario,
    clave,
    fecha_desde,
    fecha_hasta,
    token
  };
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function normalizeResponse(response) {
  if (!response || typeof response !== 'object') {
    return {
      raw: response,
      estado: false,
      mensaje: undefined,
      error: 'Respuesta inválida del servicio Cofarsur',
      cabecera: [],
      detalle: [],
      impuestos: []
    };
  }

  // toleramos mayúsculas/minúsculas
  const estado = response.estado ?? response.Estado ?? false;
  const mensaje = response.mensaje ?? response.Mensaje;
  const error = response.error ?? response.Error;

  const cabecera = normalizeArray(response.cabecera ?? response.Cabecera);
  const detalle = normalizeArray(response.detalle ?? response.Detalle);
  const impuestos = normalizeArray(response.impuestos ?? response.Impuestos);

  return {
    raw: response,
    estado,
    mensaje,
    error,
    cabecera,
    detalle,
    impuestos
  };
}

async function executeCofarsurRequest(branchCode, query) {
  const branchCredentials = await getBranchCredentials(branchCode);
  const payload = buildPayload(branchCredentials, query);
  const response = await fetchComprobantes(payload);
  const normalized = normalizeResponse(response);

  return {
    provider: 'cofarsur',
    branch: branchCredentials.branchCode,
    request: payload,
    response: normalized
  };
}

function withSelection(result, field) {
  return {
    ...result,
    requestedData: result.response?.[field] ?? []
  };
}

export function getComprobantes(branchCode, query) {
  return executeCofarsurRequest(branchCode, query);
}

export async function getComprobantesCabecera(branchCode, query) {
  const result = await executeCofarsurRequest(branchCode, query);
  return withSelection(result, 'cabecera');
}

export async function getComprobantesDetalle(branchCode, query) {
  const result = await executeCofarsurRequest(branchCode, query);
  return withSelection(result, 'detalle');
}

export async function getComprobantesImpuestos(branchCode, query) {
  const result = await executeCofarsurRequest(branchCode, query);
  return withSelection(result, 'impuestos');
}

export default {
  getComprobantes,
  getComprobantesCabecera,
  getComprobantesDetalle,
  getComprobantesImpuestos
};
