// tools/describe-suizo.js (creá este archivo temporal)
import soap from 'soap';
import config from '../config/index.js';

const { wsdlUrl } = config.providers.suizo;

soap.createClient(wsdlUrl, /* opcional: { endpoint: 'https://.../wspedidos2.asmx' } */ (err, client) => {
  if (err) {
    console.error('Error creando cliente SOAP:', err);
    process.exit(1);
  }
  const desc = client.describe();
  console.dir(desc, { depth: 10 });
  // Sugerencia: buscá el nombre exacto de la operación que sea "ConsultarFacturacion" o similar
});
