import { Router } from 'express';

import {
  getCofarsurComprobantes,
  getCofarsurComprobantesCabecera,
  getCofarsurComprobantesDetalle,
  getCofarsurComprobantesImpuestos
} from '../../controllers/cofarsurController.js';

const router = Router();

router.get('/comprobantes*', (_req, _res, next) => {
  const error = new Error(
    'Debe indicar la sucursal en la ruta. Ejemplo: /api/providers/cofarsur/SA1/comprobantes'
  );
  error.status = 400;
  next(error);
});

router.get('/:branch/comprobantes', getCofarsurComprobantes);
router.get('/:branch/comprobantes/cabecera', getCofarsurComprobantesCabecera);
router.get('/:branch/comprobantes/detalle', getCofarsurComprobantesDetalle);
router.get('/:branch/comprobantes/impuestos', getCofarsurComprobantesImpuestos);

export default router;
