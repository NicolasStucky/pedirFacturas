import { getKellerhoffProducts } from '../services/kellerhoffService.js';

export async function postKellerhoffProducts(req, res, next) {
  try {
    const result = await getKellerhoffProducts(req.body, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export default {
  postKellerhoffProducts
};
