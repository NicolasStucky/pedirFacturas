import { Router } from 'express';

import {
  getMonroeComprobanteDetalleController,
  listMonroeComprobantes,
} from '../../controllers/monroeController.js';

const router = Router();

router.get('/comprobantes', listMonroeComprobantes);
router.get('/comprobantes/:comprobanteId', getMonroeComprobanteDetalleController);

export default router;
