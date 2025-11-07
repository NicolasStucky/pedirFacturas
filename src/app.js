import express from 'express';
import cors from 'cors';

import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/', (_req, res) => {
  res.json({
    message: 'Servicio de consulta de facturas disponible',
    documentation: {
      health: '/health',
      providers: '/api/providers',
      suizo: {
        totals: '/api/providers/suizo/:branch/invoices/totals',
        details: '/api/providers/suizo/:branch/invoices/details',
        perceptions: '/api/providers/suizo/:branch/invoices/perceptions'
      },
      cofarsur: {
        comprobantes: '/api/providers/cofarsur/:branch/comprobantes',
        cabecera: '/api/providers/cofarsur/:branch/comprobantes/cabecera',
        detalle: '/api/providers/cofarsur/:branch/comprobantes/detalle',
        impuestos: '/api/providers/cofarsur/:branch/comprobantes/impuestos'
      },
      monroe: {
        comprobantes: '/api/providers/monroe/:branch/comprobantes',
        comprobanteDetalle: '/api/providers/monroe/:branch/comprobantes/:comprobanteId'
      },
      kellerhoff: {
        products: '/api/providers/kellerhoff/products'
      }
    }
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
