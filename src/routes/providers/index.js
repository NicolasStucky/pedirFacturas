import { Router } from 'express';

import { listProviders } from '../../controllers/providersController.js';
import suizoRouter from './suizoRoutes.js';
import cofarsurRouter from './cofarsurRoutes.js';

const router = Router();

router.get('/', listProviders);
router.use('/suizo', suizoRouter);
router.use('/cofarsur', cofarsurRouter);

export default router;
