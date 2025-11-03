import 'dotenv/config';

const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 3000,
  providers: {
    suizo: {
      wsdlUrl:
        process.env.SUIZO_WSDL_URL ??
        'http://pruebas.suizoargentina.com.ar/webservice/wspedidos2.wsdl',
      soapMethod: process.env.SUIZO_SOAP_METHOD ?? 'ConsultarFacturacion',
      responseField:
        process.env.SUIZO_RESPONSE_FIELD ?? 'ConsultarFacturacionResult',
      empresa: process.env.SUIZO_EMPRESA ? Number(process.env.SUIZO_EMPRESA) : 1,
      usuario: process.env.SUIZO_USUARIO ?? 'webservice',
      clave: process.env.SUIZO_CLAVE ?? '123456',
      grupo: process.env.SUIZO_GRUPO ?? 'C',
      cuenta: process.env.SUIZO_CUENTA
        ? Number(process.env.SUIZO_CUENTA)
        : undefined
    }
  }
};

export default config;
