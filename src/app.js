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
        totals: '/api/providers/suizo/invoices/totals',
        details: '/api/providers/suizo/invoices/details',
        perceptions: '/api/providers/suizo/invoices/perceptions'
      },
      cofarsur: {
        comprobantes: '/api/providers/cofarsur/comprobantes',
        cabecera: '/api/providers/cofarsur/comprobantes/cabecera',
        detalle: '/api/providers/cofarsur/comprobantes/detalle',
        impuestos: '/api/providers/cofarsur/comprobantes/impuestos'
      },
      Monroe : {
        comprobantes: '/api/providers/monroe/comprobantes',
        comprobanteDetalle : '/api/providers/monroe/comprobantes/detalle' // ✅
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
