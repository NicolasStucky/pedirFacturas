import { Router } from 'express';

import { listProviders } from '../../controllers/providersController.js';
import suizoRouter from './suizoRoutes.js';

const router = Router();

router.get('/', listProviders);
router.use('/suizo', suizoRouter);

export default router;
