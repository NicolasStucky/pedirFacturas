import { Router } from 'express';

import {
  getSuizoInvoiceDetails,
  getSuizoInvoicePerceptions,
  getSuizoInvoiceTotals
} from '../../controllers/suizoController.js';

const router = Router();

router.get('/invoices/totals', getSuizoInvoiceTotals);
router.get('/invoices/details', getSuizoInvoiceDetails);
router.get('/invoices/perceptions', getSuizoInvoicePerceptions);

export default router;
