import {
  getMonroeCabecerasForAllBranches,
  getMonroeComprobanteDetalle,
  getMonroeComprobantes,
  getMonroeComprobantesForAllBranches,
  getMonroeComprobantesSlim,
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

const TOTAL_IMPUESTOS_TEMPLATES = [
  { tipo: 'IVA', descripcion: 'I.V.A.                     21%' },
  { tipo: 'PER', descripcion: 'Perc. I.V.A. R.G. 3337      3%' },
  { tipo: 'PER', descripcion: 'Perc Mun Com,Ind y Serv 0.6%' }
];

const DETALLE_IMPUESTOS_TEMPLATES = [
  { tipo: 'IVA', descripcion: 'I.V.A.                     21%', tasa: 21 },
  { tipo: 'PER', descripcion: 'Perc. I.V.A. R.G. 3337      3%', tasa: 3 },
  { tipo: 'PER', descripcion: 'Perc Mun Com,Ind y Serv 0.6%', tasa: 0.6 }
];

function toNumberOrNull(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeImpuesto(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const tasaValue =
    raw?.tasa ??
    raw?.porcentaje ??
    raw?.alicuota ??
    raw?.tasaImpuesto ??
    raw?.tasa_impuesto;
  const importeValue =
    raw?.importe ??
    raw?.monto ??
    raw?.valor ??
    raw?.importe_total ??
    raw?.importeTotal ??
    raw?.importe_impuesto ??
    raw?.importeImpuesto;
  return {
    tipo: raw?.tipo ?? raw?.Tipo ?? raw?.codigo ?? null,
    descripcion:
      raw?.descripcion ??
      raw?.Descripcion ??
      raw?.detalle ??
      raw?.detalles ??
      null,
    tasa: toNumberOrNull(tasaValue),
    importe: toNumberOrNull(importeValue)
  };
}

function normalizeDescripcion(value) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function alignImpuestos(rawList, templates) {
  const normalizedList = Array.isArray(rawList)
    ? rawList.map((imp) => normalizeImpuesto(imp))
    : [];

  const remaining = [...normalizedList];

  const result = templates.map((tpl) => {
    const matchIndex = remaining.findIndex((imp) => {
      const descNormalized = normalizeDescripcion(imp.descripcion);
      const tplDesc = normalizeDescripcion(tpl.descripcion);
      const sameDesc = descNormalized && tplDesc && descNormalized === tplDesc;
      const sameTipo = imp.tipo && tpl.tipo && imp.tipo === tpl.tipo;
      const sameTasa = Object.prototype.hasOwnProperty.call(tpl, 'tasa')
        ? imp.tasa == null || toNumberOrNull(tpl.tasa) === toNumberOrNull(imp.tasa)
        : true;
      return sameDesc || (sameTipo && sameTasa);
    });

    const match = matchIndex >= 0 ? remaining.splice(matchIndex, 1)[0] : null;

    const base = {
      tipo: match?.tipo ?? null,
      descripcion: match?.descripcion ?? null
    };

    if (Object.prototype.hasOwnProperty.call(tpl, 'tasa')) {
      base.tasa = match?.tasa ?? null;
    }

    base.importe = match?.importe ?? null;

    return base;
  });

  return result.concat(
    remaining.map((imp) => {
      const extra = {
        tipo: imp.tipo ?? null,
        descripcion: imp.descripcion ?? null,
        importe: imp.importe ?? null
      };

      if (imp.tasa != null) {
        extra.tasa = imp.tasa;
      }

      return extra;
    })
  );
}

function buildComprobantePayload(full, { includeDetalle = true } = {}) {
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

  const totalImpuestosRaw = Array.isArray(totalRaw?.arrayImpuestos)
    ? totalRaw.arrayImpuestos
    : Array.isArray(totalRaw?.array_impuestos)
      ? totalRaw.array_impuestos
      : Array.isArray(totalRaw?.impuestos)
        ? totalRaw.impuestos
        : [];

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
    arrayImpuestos: alignImpuestos(totalImpuestosRaw, TOTAL_IMPUESTOS_TEMPLATES)
  };

  const detalleRaw =
    getFirst(resp, [
      'Detalle',
      'detalle',
      'Comprobante.Detalle',
      'Comprobante.detalle',
      'comprobante.Detalle',
      'comprobante.detalle'
    ]) || {};

  const itemsSourceCandidates = [];

  if (Array.isArray(detalleRaw)) {
    itemsSourceCandidates.push(detalleRaw);
  } else if (detalleRaw && typeof detalleRaw === 'object') {
    itemsSourceCandidates.push(
      detalleRaw.arrayItems,
      detalleRaw.array_items,
      detalleRaw.ArrayItems,
      detalleRaw.items,
      detalleRaw.detalle,
      detalleRaw.lineas
    );
  }

  const itemsRaw =
    itemsSourceCandidates.find((candidate) => Array.isArray(candidate)) ?? [];

  const arrayItems = itemsRaw.map((it) => {
    const impuestos =
      (Array.isArray(it?.arrayImpuestos) && it.arrayImpuestos) ||
      (Array.isArray(it?.array_impuestos) && it.array_impuestos) ||
      (Array.isArray(it?.impuestos) && it.impuestos) ||
      [];

    const arrayImpuestos = alignImpuestos(impuestos, DETALLE_IMPUESTOS_TEMPLATES);

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

  const conceptosSourceCandidates = [];

  if (detalleRaw && typeof detalleRaw === 'object') {
    conceptosSourceCandidates.push(
      detalleRaw.arrayConceptos,
      detalleRaw.array_conceptos,
      detalleRaw.ArrayConceptos,
      detalleRaw.conceptos,
      detalleRaw.arrayConcepto,
      detalleRaw.conceptItems
    );
  }

  const conceptosRaw =
    conceptosSourceCandidates.find((candidate) => Array.isArray(candidate)) ?? [];

  const arrayConceptos = conceptosRaw.map((concepto) =>
    pick(concepto, ['descripcion', 'bruto', 'descuento', 'neto', 'total'])
  );

  const detalle = {
    arrayItems
  };

  const hasConceptosField = conceptosSourceCandidates.some((candidate) =>
    Array.isArray(candidate)
  );

  if (hasConceptosField || arrayConceptos.length > 0) {
    detalle.arrayConceptos = arrayConceptos;
  }

  const resultadoRaw = getFirst(resp, ['Resultado', 'resultado']);
  const resultado = resultadoRaw && typeof resultadoRaw === 'object' ? { ...resultadoRaw } : null;

  const referenciaDrogueria =
    resp?.referencia_drogueria ?? resp?.referenciaDrogueria ?? null;

  const payload = {
    Cabecera: cabecera,
    Total: total,
  };

  if (includeDetalle) {
    payload.Detalle = detalle;
  }

  if (resultado) {
    payload.Resultado = resultado;
  }

  if (referenciaDrogueria != null) {
    payload.referencia_drogueria = referenciaDrogueria;
  }

  return payload;
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

    const result = await getMonroeComprobantesSlim(branch, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listMonroeComprobantesGeneral(req, res, next) {
  try {
    const data = await getMonroeComprobantesForAllBranches(req.query);
    // data = { results: [...], skipped: [...] }
    res.json(data);
  } catch (error) {
    next(error);
  }
}

/** ----------------- DETALLE (LIMPIO) ----------------- **/
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
    const payload = buildComprobantePayload(full, { includeDetalle: true });

    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function listMonroeComprobantesCabecera(req, res, next) {
  try {
    const data = await getMonroeCabecerasForAllBranches(req.query);

    const results = data.results.map((entry) => ({
      provider: entry.provider,
      branch: entry.branch,
      data: entry.data
        .map(({ comprobanteId, full }) => {
          if (!full) return null;
          const payload = buildComprobantePayload(full, {
            includeDetalle: false,
          });

          return {
            comprobante_id: comprobanteId,
            ...payload,
          };
        })
        .filter(Boolean),
    }));

    res.json({
      results,
      skipped: data.skipped ?? [],
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
  listMonroeComprobantesGeneral,
  listMonroeComprobantesCabecera,
  listMonroeComprobantesSlim,
  getMonroeComprobanteDetalleController, // (detalle limpio)
  monroeLoginProbeController
};
