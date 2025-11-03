import {
  getInvoiceDetails,
  getInvoicePerceptions,
  getInvoiceTotals
} from '../services/suizoService.js';

export async function getSuizoInvoiceTotals(req, res, next) {
  try {
    const result = await getInvoiceTotals(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getSuizoInvoiceDetails(req, res, next) {
  try {
    const result = await getInvoiceDetails(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getSuizoInvoicePerceptions(req, res, next) {
  try {
    const result = await getInvoicePerceptions(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export default {
  getSuizoInvoiceTotals,
  getSuizoInvoiceDetails,
  getSuizoInvoicePerceptions
};
