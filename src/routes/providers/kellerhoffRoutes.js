import { Router } from 'express';

import { postKellerhoffProducts } from '../../controllers/kellerhoffController.js';

const router = Router();

router.post('/products', postKellerhoffProducts);

export default router;
