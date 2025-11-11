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

/** Endpoint original (respuesta completa) */
export async function listMonroeComprobantes(req, res, next) {
  try {
    const result = await getMonroeComprobantes(req.params.branchs, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/** Endpoint detalle */
export async function getMonroeComprobanteDetalleController(req, res, next) {
  try {
    const result = await getMonroeComprobanteDetalle(
      req.params.branchs,
      req.params.comprobanteId,
      req.query
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/** Diagnóstico de login */
export async function monroeLoginProbeController(req, res, next) {
  try {
    const result = await monroeLoginProbe(req.params.branchs, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * NUEVO endpoint "slim"
 * GET /api/providers/monroe/:branchs/comprobantes
 * Devuelve solo customer_reference, fecha, codigo_busqueda
 */
export async function listMonroeComprobantesSlim(req, res, next) {
  try {
    const branch = (req.params.branchs || '').trim();
    if (!branch) {
      const err = new Error('Debe indicar la sucursal en la ruta (ej.: /monroe/SA3/comprobantes)');
      err.status = 400;
      throw err;
    }

    // Consulta completa (ya maneja token + retry)
    const full = await getMonroeComprobantes(branch, req.query);

    const customerRef = full?.request?.credentials?.customerReference ?? null;

    // Extrae datos mínimos
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

export default {
  listMonroeComprobantes,
  listMonroeComprobantesSlim,
  getMonroeComprobanteDetalleController,
  monroeLoginProbeController
};
