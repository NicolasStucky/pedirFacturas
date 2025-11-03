import config from '../config/index.js';
import { fetchInvoices } from '../clients/suizoClient.js';
import { ensureMaxRange, getDefaultRange } from '../utils/date.js';

const MAX_RANGE_DAYS = 6; // 7 días corridos incluyendo límites

// Para el método Facturas:
// - tcGrupo  -> 'C' (Cuenta) | 'G' (Grupo)  ← ¡LETRA MAYÚSCULA!
// - tcItems  -> 'F' (cabeceras) | 'D' (detalles) | 'P' (percepciones)
const ITEMS_MAP = {
  totals: 'F',
  details: 'D',
  perceptions: 'P',
};

function resolveTcGrupo(tnCuentaFromQuery, tnCuentaFromEnv, tcGrupoOverride) {
  // Si el usuario forzó tcGrupo por query, lo respetamos si es válido
  if (tcGrupoOverride) {
    const v = String(tcGrupoOverride).toUpperCase();
    if (v === 'C' || v === 'G') return v;
  }
  // Si hay cuenta (query o env) => por defecto 'C' (Cuenta). Si no, 'G' (Grupo)
  if (tnCuentaFromQuery ?? tnCuentaFromEnv) return 'C';
  return 'G';
}

function buildBasePayload(query, itemsKey) {
  const { suizo } = config.providers;

  const {
    tcDesde: rawDesde,
    tcHasta: rawHasta,
    tnEmpresa,
    tcUsuario,
    tcClave,
    tnCuenta,
    tcItems,   // override manual de items si llega por query
    tcGrupo,   // override manual de grupo si llega por query ('C' o 'G')
  } = query;

  // Rango por defecto + validación
  const defaults = getDefaultRange(MAX_RANGE_DAYS);
  const tcDesde = rawDesde ?? defaults.desde;
  const tcHasta = rawHasta ?? defaults.hasta;
  ensureMaxRange(tcDesde, tcHasta, MAX_RANGE_DAYS);

  // Determinar grupo y cuenta
  const cuentaFinal = (tnCuenta ?? suizo.cuenta);
  const grupoFinal = resolveTcGrupo(tnCuenta, suizo.cuenta, tcGrupo);

  const payload = {
    tnEmpresa: tnEmpresa ? Number(tnEmpresa) : Number(suizo.empresa),
    tcUsuario: tcUsuario ?? suizo.usuario,
    tcClave:   tcClave   ?? suizo.clave,
    tcGrupo:   grupoFinal,  // 'C' o 'G'
    tcDesde,
    tcHasta,
  };

  // Si grupo es 'C' y no tenemos cuenta => error claro
  if (grupoFinal === 'C') {
    if (cuentaFinal === undefined || cuentaFinal === '' || isNaN(Number(cuentaFinal))) {
      const err = new Error('Para tcGrupo="C" (Cuenta) debe indicar tnCuenta (query) o SUIZO_CUENTA en .env.');
      err.status = 400;
      throw err;
    }
    payload.tnCuenta = Number(cuentaFinal);
  }

  // tcItems según endpoint (F/D/P) o override de query
  const itemsByEndpoint = ITEMS_MAP[itemsKey]; // 'F' | 'D' | 'P'
  payload.tcItems = (typeof tcItems === 'string' && tcItems.length > 0)
    ? tcItems.toUpperCase()
    : itemsByEndpoint;

  return payload;
}

async function executeSuizoRequest(query, itemsKey) {
  const payload = buildBasePayload(query, itemsKey);
  const response = await fetchInvoices(payload);

  return {
    provider: 'suizo',
    request: payload,
    response,
  };
}

// Endpoints públicos usados por las rutas
export function getInvoiceTotals(query) {
  return executeSuizoRequest(query, 'totals');       // tcItems = 'F'
}

export function getInvoiceDetails(query) {
  return executeSuizoRequest(query, 'details');      // tcItems = 'D'
}

export function getInvoicePerceptions(query) {
  return executeSuizoRequest(query, 'perceptions');  // tcItems = 'P'
}

export default {
  getInvoiceTotals,
  getInvoiceDetails,
  getInvoicePerceptions,
};
