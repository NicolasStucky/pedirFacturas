/* import {
  getMonroeComprobanteDetalle,
  getMonroeComprobantes,
} from '../services/monroeService.js';

export async function listMonroeComprobantes(req, res, next) {
  try {
    const result = await getMonroeComprobantes(req.params.branch, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getMonroeComprobanteDetalleController(req, res, next) {
  try {
    const result = await getMonroeComprobanteDetalle(
      req.params.branch,
      req.params.comprobanteId,
      req.query
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export default {
  listMonroeComprobantes,
  getMonroeComprobanteDetalleController,
};
 */





// // // // //          LIMPIEZA DE TABLA     // // // // // // //

import {
  getMonroeComprobanteDetalle,
  getMonroeComprobantes,
  monroeLoginProbe
} from '../services/monroeService.js';

/** ----------------- HELPERS ----------------- **/

function pick(obj, keys) {
  const out = {};
  for (const k of keys) out[k] = obj?.[k] ?? null;
  return out;
}

function getFirst(obj, paths) {
  for (const p of paths) {
    const val = p.split('.').reduce((acc, seg) => (acc == null ? acc : acc[seg]), obj);
    if (val != null) return val;
  }
  return undefined;
}

/** Busca un impuesto por tipo/jurisdicción y normaliza su forma */
function findTax(arrayImpuestos, tipo, jurisdiccion) {
  if (!Array.isArray(arrayImpuestos)) return null;
  const found = arrayImpuestos.find((t) => {
    const okTipo = String(t?.tipo ?? '').toUpperCase() === String(tipo).toUpperCase();
    const okJur = jurisdiccion
      ? String(t?.jurisdiccion ?? '').toUpperCase() === String(jurisdiccion).toUpperCase()
      : true;
    return okTipo && okJur;
  });
  if (!found) return null;
  return {
    tipo: found.tipo ?? null,
    jurisdiccion: found.jurisdiccion ?? null,
    provincia: found.provincia ?? null,
    descripcion: found.descripcion ?? null,
    tasa: found.tasa ?? null,
    importe: found.importe ?? null
  };
}

/** ----------------- LISTA ----------------- **/

/** Lista full (se mantiene) */
export async function listMonroeComprobantes(req, res, next) {
  try {
    const result = await getMonroeComprobantes(req.params.branchs, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Lista “slim”
 * GET /api/providers/monroe/:branchs/comprobantes
 * Devuelve: customer_reference, fecha, codigo_busqueda
 */
export async function listMonroeComprobantesSlim(req, res, next) {
  try {
    const branch = (req.params.branchs || '').trim();
    if (!branch) {
      const err = new Error('Debe indicar la sucursal en la ruta (ej.: /monroe/SA3/comprobantes)');
      err.status = 400;
      throw err;
    }

    // Consulta completa (maneja token + retry)
    const full = await getMonroeComprobantes(branch, req.query);
    const customerRef = full?.request?.credentials?.customerReference ?? null;

    const items = Array.isArray(full?.response?.Comprobantes)
      ? full.response.Comprobantes
      : [];

    const data = items.map((it) => {
      const cab = it?.Comprobante?.Cabecera ?? it?.Cabecera ?? {};
      return {
        customer_reference: customerRef,
        fecha: cab?.fecha ?? null,
        codigo_busqueda: cab?.codigo_busqueda ?? cab?.codigoBusqueda ?? null
      };
    });

    res.json({
      provider: 'monroe',
      branch,
      data
    });
  } catch (error) {
    next(error);
  }
}

/** ----------------- DETALLE (LIMPIO) ----------------- **/

/**
 * Detalle “limpio”
 * GET /api/providers/monroe/:branchs/comprobantes/:comprobanteId
 *
 * Devuelve:
 * {
 *   provider: 'monroe',
 *   branch: 'SA3',
 *   cabecera: { codigo: '...' },                // solo Cabecera.Autorizacion.codigo
 *   detalle: [ { ...item base..., arrayImpuestos: [IB, MUNICIPAL, IVA] } ]
 * }
 */
export async function getMonroeComprobanteDetalleController(req, res, next) {
  try {
    const branch = (req.params.branchs || '').trim();
    const comprobanteId = (req.params.comprobanteId || '').trim();
    if (!branch) {
      const err = new Error('Debe indicar la sucursal en la ruta (ej.: /monroe/SA3/...)');
      err.status = 400;
      throw err;
    }
    if (!comprobanteId) {
      const err = new Error('Debe indicar el identificador del comprobante en la ruta');
      err.status = 400;
      throw err;
    }

    // Servicio (login/refresh/retry manejado en capa service)
    const full = await getMonroeComprobanteDetalle(branch, comprobanteId, req.query);
    const resp = full?.response ?? {};

    // Cabecera tolerando variantes
    const cab = getFirst(resp, [
      'Cabecera',
      'Comprobante.Cabecera',
      'comprobante.Cabecera'
    ]) || {};

    const codigo = cab?.Autorizacion?.codigo ?? null;

    // Detalle tolerando variantes
    let items = getFirst(resp, [
      'Detalle.arrayItems',
      'Comprobante.Detalle.arrayItems',
      'Detalle',
      'Comprobante.Detalle'
    ]);

    if (!Array.isArray(items)) {
      const maybeArray =
        items?.items ||
        items?.array_items ||
        items?.ArrayItems ||
        items?.detalle ||
        items?.lineas;
      items = Array.isArray(maybeArray) ? maybeArray : [];
    }

    // Normalización de items: dejar base + arrayImpuestos SIEMPRE con 3 entradas (IB → MUNICIPAL → IVA)
    const detalleLimpio = items.map((it) => {
      // Busco impuestos en distintas variantes de nombre
      const taxes =
        (Array.isArray(it?.arrayImpuestos) && it.arrayImpuestos) ||
        (Array.isArray(it?.array_impuestos) && it.array_impuestos) ||
        (Array.isArray(it?.Impuestos) && it.Impuestos) ||
        (Array.isArray(it?.impuestos) && it.impuestos) ||
        [];

      const taxIB = findTax(taxes, 'IB', 'PROV');
      const taxMUN = findTax(taxes, 'PER', 'MUN');
      const taxIVA = findTax(taxes, 'IVA', 'NAC');

      // Construyo SIEMPRE las 3 entradas, con nulls cuando no existan
      const arrayImpuestos = [
        {
          tipo: 'IB',
          jurisdiccion: 'PROV',
          provincia: taxIB?.provincia ?? null,
          descripcion: taxIB?.descripcion ?? null,
          tasa: taxIB?.tasa ?? null,
          importe: taxIB?.importe ?? null
        },
        {
          tipo: 'MUNICIPAL',
          jurisdiccion: 'MUN',
          provincia: taxMUN?.provincia ?? null,
          descripcion: taxMUN?.descripcion ?? null,
          tasa: taxMUN?.tasa ?? null,
          importe: taxMUN?.importe ?? null
        },
        {
          tipo: 'IVA',
          jurisdiccion: 'NAC',
          provincia: taxIVA?.provincia ?? null,
          descripcion: taxIVA?.descripcion ?? null,
          tasa: taxIVA?.tasa ?? null,
          importe: taxIVA?.importe ?? null
        }
      ];

      // Base: SOLO los campos del ítem que querés conservar
      const base = pick(it, [
        'item_id',
        'codigo_barra',
        'descripcion',
        'nro_linea',
        'pvp_unitario',
        'unidades',
        'bruto',
        'descuento',
        'neto',
        'total',
        'refer_pedido'
        // NO incluimos arrayLotes en la salida final (según tu ejemplo)
      ]);

      return {
        ...base,
        arrayImpuestos
      };
    });

    res.json({
      provider: 'monroe',
      branch,
      cabecera: { codigo },
      detalle: detalleLimpio
    });
  } catch (error) {
    next(error);
  }
}

/** ----------------- LOGIN PROBE ----------------- **/
export async function monroeLoginProbeController(req, res, next) {
  try {
    const result = await monroeLoginProbe(req.params.branchs, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export default {
  listMonroeComprobantes,
  listMonroeComprobantesSlim,
  getMonroeComprobanteDetalleController, // (detalle limpio)
  monroeLoginProbeController
};
