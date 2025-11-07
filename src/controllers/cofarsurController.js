import {
  getComprobantes,
  getComprobantesCabecera,
  getComprobantesDetalle,
  getComprobantesImpuestos
} from '../services/cofarsurService.js';

export async function getCofarsurComprobantes(req, res, next) {
  try {
    const result = await getComprobantes(req.params.branch, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCofarsurComprobantesCabecera(req, res, next) {
  try {
    const result = await getComprobantesCabecera(req.params.branch, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCofarsurComprobantesDetalle(req, res, next) {
  try {
    const result = await getComprobantesDetalle(req.params.branch, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCofarsurComprobantesImpuestos(req, res, next) {
  try {
    const result = await getComprobantesImpuestos(req.params.branch, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export default {
  getCofarsurComprobantes,
  getCofarsurComprobantesCabecera,
  getCofarsurComprobantesDetalle,
  getCofarsurComprobantesImpuestos
};
