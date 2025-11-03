import { Router } from 'express';

import PROVIDERS from '../../constants/providers.js';

const router = Router({ mergeParams: true });

router.use((req, res, next) => {
  const { provider } = req.params;
  const providerExists = PROVIDERS.some((item) => item.id === provider && item.id !== 'suizo');

  if (!providerExists) {
    return res.status(404).json({
      message: 'Proveedor no disponible o manejado por otra ruta'
    });
  }

  return next();
});

const notImplemented = (_req, res) =>
  res.status(501).json({
    message: 'Integración pendiente. Utilice la capa de servicios para implementar la llamada a este proveedor.'
  });

router.get('/invoices/totals', notImplemented);
router.get('/invoices/details', notImplemented);

export default router;
