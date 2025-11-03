import app from './app.js';
import config from './config/index.js';

const { port } = config;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
