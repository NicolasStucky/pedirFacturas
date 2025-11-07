import { Router } from 'express';

import {
  getSuizoInvoiceDetails,
  getSuizoInvoicePerceptions,
  getSuizoInvoiceTotals
} from '../../controllers/suizoController.js';

const router = Router();

router.get('/invoices/:type', (_req, _res, next) => {
  const error = new Error(
    'Debe indicar la sucursal en la ruta. Ejemplo: /api/providers/suizo/SA1/invoices/totals'
  );
  error.status = 400;
  next(error);
});

router.get('/:branch/invoices/totals', getSuizoInvoiceTotals);
router.get('/:branch/invoices/details', getSuizoInvoiceDetails);
router.get('/:branch/invoices/perceptions', getSuizoInvoicePerceptions);

export default router;
