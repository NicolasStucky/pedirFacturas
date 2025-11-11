/* import { Router } from 'express';

import {
  getMonroeComprobanteDetalleController,
  listMonroeComprobantes,
} from '../../controllers/monroeController.js';

const router = Router();

router.get('/comprobantes', (_req, _res, next) => {
  const error = new Error(
    'Debe indicar la sucursal en la ruta. Ejemplo: /api/providers/monroe/SA1/comprobantes'
  );
  error.status = 400;
  next(error);
});

router.get('/:branch/comprobantes', listMonroeComprobantes);
router.get(
  '/:branch/comprobantes/:comprobanteId',
  getMonroeComprobanteDetalleController
);

export default router;
 */



////////////// LIMPIEZA DE TABLA //////////////////
import { Router } from 'express';

import {
  getMonroeComprobanteDetalleController,
  listMonroeComprobantes,
  monroeLoginProbeController,
  listMonroeComprobantesSlim
} from '../../controllers/monroeController.js';

const router = Router();

// Diagnóstico de login
router.get('/:branchs/_login', monroeLoginProbeController);

// Endpoint simplificado (solo customer_reference, fecha, codigo_busqueda)
router.get('/:branchs/comprobantes', listMonroeComprobantesSlim);

// Endpoint completo con todos los datos
router.get('/:branchs/comprobantes/full', listMonroeComprobantes);

// Detalle de comprobante individual
router.get('/:branchs/comprobantes/:comprobanteId', getMonroeComprobanteDetalleController);

export default router;
