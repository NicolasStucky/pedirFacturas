import { Router } from 'express';

import {
  getCofarsurComprobantes,
  getCofarsurComprobantesCabecera,
  getCofarsurComprobantesDetalle,
  getCofarsurComprobantesImpuestos
} from '../../controllers/cofarsurController.js';

const router = Router();

router.get('/comprobantes', getCofarsurComprobantes);
router.get('/comprobantes/cabecera', getCofarsurComprobantesCabecera);
router.get('/comprobantes/detalle', getCofarsurComprobantesDetalle);
router.get('/comprobantes/impuestos', getCofarsurComprobantesImpuestos);

export default router;
