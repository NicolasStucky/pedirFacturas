import config from '../config/index.js';
import { fetchInvoices } from '../clients/suizoClient.js';
import { ensureMaxRange, getDefaultRange } from '../utils/date.js';

const MAX_RANGE_DAYS = 6; // 7 días corridos incluyendo límites

function buildBasePayload(query, itemType) {
  const { suizo } = config.providers;
  const {
    tcDesde: rawDesde,
    tcHasta: rawHasta,
    tnEmpresa,
    tcUsuario,
    tcClave,
    tcGrupo,
    tnCuenta,
    tcItems
  } = query;

  const defaults = getDefaultRange(MAX_RANGE_DAYS);
  const tcDesde = rawDesde ?? defaults.desde;
  const tcHasta = rawHasta ?? defaults.hasta;

  ensureMaxRange(tcDesde, tcHasta, MAX_RANGE_DAYS);

  const payload = {
    tnEmpresa: tnEmpresa ? Number(tnEmpresa) : suizo.empresa,
    tcUsuario: tcUsuario ?? suizo.usuario,
    tcClave: tcClave ?? suizo.clave,
    tcGrupo: tcGrupo ?? suizo.grupo,
    tcDesde,
    tcHasta,
    tcItems: itemType ?? tcItems ?? 'F'
  };

  const cuenta = tnCuenta ?? suizo.cuenta;
  if (cuenta !== undefined && cuenta !== '') {
    payload.tnCuenta = Number(cuenta);
  }

  return payload;
}

async function executeSuizoRequest(query, itemType) {
  const payload = buildBasePayload(query, itemType);
  const response = await fetchInvoices(payload);

  return {
    provider: 'suizo',
    request: payload,
    response
  };
}

export function getInvoiceTotals(query) {
  return executeSuizoRequest(query, 'F');
}

export function getInvoiceDetails(query) {
  return executeSuizoRequest(query, 'D');
}

export function getInvoicePerceptions(query) {
  return executeSuizoRequest(query, 'P');
}

export default {
  getInvoiceTotals,
  getInvoiceDetails,
  getInvoicePerceptions
};
