import { Router } from 'express';

import { listProviders } from '../../controllers/providersController.js';
import suizoRouter from './suizoRoutes.js';
import placeholderRouter from './placeholderRoutes.js';

const router = Router();

router.get('/', listProviders);
router.use('/suizo', suizoRouter);
router.use('/:provider', placeholderRouter);

export default router;
