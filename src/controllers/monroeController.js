import {
  getMonroeComprobanteDetalle,
  getMonroeComprobantes,
} from '../services/monroeService.js';

export async function listMonroeComprobantes(req, res, next) {
  try {
    const result = await getMonroeComprobantes(req.params.branch, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getMonroeComprobanteDetalleController(req, res, next) {
  try {
    const result = await getMonroeComprobanteDetalle(
      req.params.branch,
      req.params.comprobanteId,
      req.query
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export default {
  listMonroeComprobantes,
  getMonroeComprobanteDetalleController,
};
