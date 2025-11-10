import config from '../config/index.js';
import { fetchInvoices } from '../clients/suizoClient.js';
import {
  ensureMaxRange,
  getDefaultRange,
  parseDDMMYYYY,
  formatToDDMMYYYY,
} from '../utils/date.js';
import {
  getBranchCredentials,
  normalizeBranchCode,
} from '../repositories/branchCredentialsRepository.js';

const MAX_RANGE_DAYS = 6; // 7 días corridos incluyendo límites

function ensureDateOnly(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  try {
    const parsedDate = parseDDMMYYYY(trimmed);
    return formatToDDMMYYYY(parsedDate);
  } catch (error) {
    const [dayPart] = trimmed.split(' ');
    return dayPart;
  }
}

// Para el método Facturas:
// - tcGrupo  -> 'C' (Cuenta) | 'G' (Grupo)  ← ¡LETRA MAYÚSCULA!
// - tcItems  -> 'F' (cabeceras) | 'D' (detalles) | 'P' (percepciones)
const ITEMS_MAP = {
  totals: 'F',
  details: 'D',
  perceptions: 'P',
};

function resolveTcGrupo(
  tnCuentaFromQuery,
  tnCuentaFromBranch,
  tnCuentaFromEnv,
  tcGrupoOverride
) {
  // Si el usuario forzó tcGrupo por query, lo respetamos si es válido
  if (tcGrupoOverride) {
    const v = String(tcGrupoOverride).toUpperCase();
    if (v === 'C' || v === 'G') return v;
  }
  // Si hay cuenta (query o env) => por defecto 'C' (Cuenta). Si no, 'G' (Grupo)
  if (tnCuentaFromQuery ?? tnCuentaFromBranch ?? tnCuentaFromEnv) return 'C';
  return 'G';
}

function buildBasePayload(branchCredentials, query, itemsKey) {
  const { suizo } = config.providers;
  const branchSuizo = branchCredentials?.suizo ?? {};

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
  const normalizedRawDesde = typeof rawDesde === 'string' ? rawDesde.trim() : rawDesde;
  const normalizedRawHasta = typeof rawHasta === 'string' ? rawHasta.trim() : rawHasta;

  const tcDesde = normalizedRawDesde ?? defaults.desde;
  const tcHasta = normalizedRawHasta ?? defaults.hasta;
  ensureMaxRange(tcDesde, tcHasta, MAX_RANGE_DAYS);

  const payloadDesde = ensureDateOnly(tcDesde);
  const payloadHasta = ensureDateOnly(tcHasta);

  // Determinar grupo y cuenta
  const cuentaFinal = tnCuenta ?? branchSuizo.cuenta ?? suizo.cuenta;
  const grupoFinal = resolveTcGrupo(
    tnCuenta,
    branchSuizo.cuenta,
    suizo.cuenta,
    tcGrupo
  );

  const payload = {
    tnEmpresa: tnEmpresa ? Number(tnEmpresa) : Number(suizo.empresa),
    tcUsuario: tcUsuario ?? branchSuizo.usuario ?? suizo.usuario,
    tcClave:   tcClave   ?? branchSuizo.clave   ?? suizo.clave,
    tcGrupo:   grupoFinal,  // 'C' o 'G'
    tcDesde: payloadDesde,
    tcHasta: payloadHasta,
  };

  // Si grupo es 'C' y no tenemos cuenta => error claro
  if (grupoFinal === 'C') {
    if (cuentaFinal === undefined || cuentaFinal === '' || isNaN(Number(cuentaFinal))) {
      const err = new Error(
        'Para tcGrupo="C" (Cuenta) debe indicar tnCuenta (query) o contar con una cuenta configurada para la sucursal.'
      );
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

async function executeSuizoRequest(branchCode, query, itemsKey) {
  const normalizedBranch = normalizeBranchCode(branchCode);
  const branchCredentials = await getBranchCredentials(branchCode);
  const payload = buildBasePayload(branchCredentials, query, itemsKey);
  const response = await fetchInvoices(payload);

  const branchLabel = branchCredentials.branchCode ?? normalizedBranch ?? branchCode;

  const parsedWithBranch = Array.isArray(response.parsed)
    ? response.parsed.map((row) => {
        if (!row || typeof row !== 'object') return row;

        const providerBranch =
          row.sucursalProveedor ??
          row.sucursal_proveedor ??
          row.sucursal;

        return {
          ...row,
          ...(providerBranch !== undefined && providerBranch !== branchLabel
            ? { sucursalProveedor: providerBranch }
            : {}),
          sucursal: branchLabel,
        };
      })
    : response.parsed;

  const responseWithBranch =
    parsedWithBranch === response.parsed
      ? response
      : { ...response, parsed: parsedWithBranch };

  return {
    provider: 'suizo',
    branch: branchLabel,
    requestedBranch: normalizedBranch ?? branchCode,
    request: payload,
    response: responseWithBranch,
  };
}

// Endpoints públicos usados por las rutas
export function getInvoiceTotals(branchCode, query) {
  return executeSuizoRequest(branchCode, query, 'totals');       // tcItems = 'F'
}

export function getInvoiceDetails(branchCode, query) {
  return executeSuizoRequest(branchCode, query, 'details');      // tcItems = 'D'
}

export function getInvoicePerceptions(branchCode, query) {
  return executeSuizoRequest(branchCode, query, 'perceptions');  // tcItems = 'P'
}

export default {
  getInvoiceTotals,
  getInvoiceDetails,
  getInvoicePerceptions,
};
