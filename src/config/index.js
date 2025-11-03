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
    },
    cofarsur: {
      apiUrl: process.env.COFARSUR_API_URL,
      usuario: process.env.COFARSUR_USUARIO,
      clave: process.env.COFARSUR_CLAVE,
      token: process.env.COFARSUR_TOKEN,
      maxRangeDays: process.env.COFARSUR_MAX_RANGE_DAYS
        ? Number(process.env.COFARSUR_MAX_RANGE_DAYS)
        : 6
    },
    monroe: {
      baseUrl:
        process.env.MONROE_BASE_URL ??
        'https://servicios-test.monroeamericana.com.ar/api-cli/',
      adeVersion: process.env.MONROE_ADE_VERSION ?? 'ade/1.0.0',
      softwareKey: process.env.MONROE_SOFTWARE_KEY,
      customerKey: process.env.MONROE_CUSTOMER_KEY,
      customerReference: process.env.MONROE_CUSTOMER_REFERENCE,
      tokenDurationMinutes: process.env.MONROE_TOKEN_DURATION
        ? Number(process.env.MONROE_TOKEN_DURATION)
        : undefined,
      timeout: process.env.MONROE_TIMEOUT
        ? Number(process.env.MONROE_TIMEOUT)
        : undefined
    }
  }
};

export default config;
