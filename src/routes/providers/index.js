import { Router } from 'express';

import { listProviders } from '../../controllers/providersController.js';
import suizoRouter from './suizoRoutes.js';
import cofarsurRouter from './cofarsurRoutes.js';
import monroeRouter from './monroeRoutes.js';
import kellerhoffRouter from './kellerhoffRoutes.js';

const router = Router();

router.get('/', listProviders);
router.use('/suizo', suizoRouter);
router.use('/cofarsur', cofarsurRouter);
router.use('/monroe', monroeRouter);
router.use('/kellerhoff', kellerhoffRouter);

export default router;
