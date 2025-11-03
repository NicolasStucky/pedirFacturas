import { Router } from 'express';

import providersRouter from './providers/index.js';

const router = Router();

router.use('/providers', providersRouter);

export default router;
