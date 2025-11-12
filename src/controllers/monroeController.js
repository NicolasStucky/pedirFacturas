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
 *   Cabecera: { ... },
 *   Total: { ... },
 *   Detalle: { arrayItems: [ ... ] }
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

    const cabeceraRaw =
      getFirst(resp, [
        'Cabecera',
        'Comprobante.Cabecera',
        'comprobante.Cabecera'
      ]) || {};

    const resumenRaw = cabeceraRaw?.Resumen ?? cabeceraRaw?.resumen ?? {};
    const autorizacionRaw = cabeceraRaw?.Autorizacion ?? cabeceraRaw?.autorizacion ?? {};

    const cabecera = {
      codigo_comprobante:
        cabeceraRaw?.codigo_comprobante ??
        cabeceraRaw?.codigoComprobante ??
        cabeceraRaw?.codigo ??
        null,
      tipo: cabeceraRaw?.tipo ?? null,
      letra: cabeceraRaw?.letra ?? null,
      punto_de_venta:
        cabeceraRaw?.punto_de_venta ??
        cabeceraRaw?.puntoDeVenta ??
        cabeceraRaw?.pto_venta ??
        cabeceraRaw?.ptoVenta ??
        null,
      numero: cabeceraRaw?.numero ?? cabeceraRaw?.nro ?? null,
      fecha: cabeceraRaw?.fecha ?? null,
      moneda: cabeceraRaw?.moneda ?? null,
      termino_de_pago:
        cabeceraRaw?.termino_de_pago ??
        cabeceraRaw?.terminoDePago ??
        cabeceraRaw?.termino_pago ??
        null,
      pdf: cabeceraRaw?.pdf ?? cabeceraRaw?.url_pdf ?? cabeceraRaw?.link_pdf ?? null,
      tipo_pedido:
        cabeceraRaw?.tipo_pedido ??
        cabeceraRaw?.tipoPedido ??
        cabeceraRaw?.tipo_ped ??
        null,
      Resumen: {
        numero: resumenRaw?.numero ?? resumenRaw?.nro ?? null,
        fecha_cierre:
          resumenRaw?.fecha_cierre ??
          resumenRaw?.fechaCierre ??
          resumenRaw?.cierre ??
          null
      },
      Autorizacion: {
        tipo: autorizacionRaw?.tipo ?? null,
        codigo: autorizacionRaw?.codigo ?? autorizacionRaw?.cod ?? null,
        vencimiento:
          autorizacionRaw?.vencimiento ??
          autorizacionRaw?.fecha_vencimiento ??
          autorizacionRaw?.fechaVencimiento ??
          null
      }
    };

    const totalRaw =
      getFirst(resp, [
        'Total',
        'Comprobante.Total',
        'comprobante.Total'
      ]) || {};

    const total = {
      lineas: totalRaw?.lineas ?? totalRaw?.cant_lineas ?? null,
      unidades: totalRaw?.unidades ?? totalRaw?.cant_unidades ?? null,
      bruto: totalRaw?.bruto ?? null,
      descuento: totalRaw?.descuento ?? null,
      neto: totalRaw?.neto ?? null,
      exento: totalRaw?.exento ?? null,
      gravado: totalRaw?.gravado ?? null,
      iva: totalRaw?.iva ?? totalRaw?.importe_iva ?? null,
      otros_impuestos:
        totalRaw?.otros_impuestos ??
        totalRaw?.otrosImpuestos ??
        totalRaw?.otros ??
        null,
      total: totalRaw?.total ?? null,
      arrayImpuestos: Array.isArray(totalRaw?.arrayImpuestos)
        ? totalRaw.arrayImpuestos
        : Array.isArray(totalRaw?.array_impuestos)
        ? totalRaw.array_impuestos
        : Array.isArray(totalRaw?.impuestos)
        ? totalRaw.impuestos
        : []
    };

    let itemsRaw = getFirst(resp, [
      'Detalle.arrayItems',
      'Comprobante.Detalle.arrayItems',
      'Detalle',
      'Comprobante.Detalle'
    ]);

    if (!Array.isArray(itemsRaw)) {
      const maybeArray =
        itemsRaw?.items ||
        itemsRaw?.array_items ||
        itemsRaw?.ArrayItems ||
        itemsRaw?.detalle ||
        itemsRaw?.lineas;
      itemsRaw = Array.isArray(maybeArray) ? maybeArray : [];
    }

    const arrayItems = itemsRaw.map((it) => {
      const impuestos =
        (Array.isArray(it?.arrayImpuestos) && it.arrayImpuestos) ||
        (Array.isArray(it?.array_impuestos) && it.array_impuestos) ||
        (Array.isArray(it?.impuestos) && it.impuestos) ||
        [];

      const arrayImpuestos = impuestos.map((imp) => ({
        tipo: imp?.tipo ?? null,
        descripcion: imp?.descripcion ?? null,
        tasa: imp?.tasa ?? null,
        importe: imp?.importe ?? null
      }));

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
      ]);

      return {
        ...base,
        arrayImpuestos
      };
    });

    const detalle = {
      arrayItems
    };

    res.json({
      Cabecera: cabecera,
      Total: total,
      Detalle: detalle
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
