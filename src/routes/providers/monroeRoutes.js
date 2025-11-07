import { Router } from 'express';

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
