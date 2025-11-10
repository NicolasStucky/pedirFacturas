import 'dotenv/config';

const cfg = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 3000,
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    name: process.env.DB_NAME,
  },
  providers: {
    suizo: {
      wsdlUrl:
        process.env.SUIZO_WSDL_URL ??
        'https://ws.suizoargentina.com/webservice/wspedidos2.wsdl',
      soapMethod: process.env.SUIZO_SOAP_METHOD ?? 'Facturas',
      responseField: process.env.SUIZO_RESPONSE_FIELD ?? 'FacturasResult',
      empresa: process.env.SUIZO_EMPRESA ? Number(process.env.SUIZO_EMPRESA) : 1,
      usuario: process.env.SUIZO_USUARIO ?? 'webservice',
      clave: process.env.SUIZO_CLAVE ?? '123456',
      grupo: process.env.SUIZO_GRUPO ?? 'C',
      cuenta: process.env.SUIZO_CUENTA ? Number(process.env.SUIZO_CUENTA) : undefined,
      endpoint: process.env.SUIZO_ENDPOINT ?? undefined,
      forceSoap12Headers: process.env.SUIZO_FORCE_SOAP12_HEADERS === 'true'
    },

    cofarsur: {
      // Remoto
      wsdlUrl: process.env.COFARSUR_WSDL_URL || null,
      // Local (archivo) — si no hay WSDL público
      wsdlFile: process.env.COFARSUR_WSDL_FILE || null,

      endpoint: process.env.COFARSUR_ENDPOINT || 'https://www.cofarsur.net/ws',
      soapMethod: 'ExportacionComprobantes',
      responseField: 'return',
      timeout: process.env.COFARSUR_TIMEOUT ? Number(process.env.COFARSUR_TIMEOUT) : 20000,

      usuario: process.env.COFARSUR_USUARIO,
      clave: process.env.COFARSUR_CLAVE,
      token: process.env.COFARSUR_TOKEN,

      maxRangeDays: process.env.COFARSUR_MAX_RANGE_DAYS
        ? Number(process.env.COFARSUR_MAX_RANGE_DAYS)
        : 4
    },
    monroe: {
      baseUrl:
        process.env.MONROE_BASE_URL ??
        'https://servicios.monroeamericana.com.ar/api-cli/',
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
    },

    kellerhoff: {
      baseUrl: process.env.KELLERHOFF_BASE_URL,
      email: process.env.KELLERHOFF_EMAIL,
      password: process.env.KELLERHOFF_PASSWORD,
      pharmacyReference:
        process.env.KELLERHOFF_PHARMACY_REFERENCE != null &&
        process.env.KELLERHOFF_PHARMACY_REFERENCE !== ''
          ? Number(process.env.KELLERHOFF_PHARMACY_REFERENCE)
          : undefined,
      timeout: process.env.KELLERHOFF_TIMEOUT
        ? Number(process.env.KELLERHOFF_TIMEOUT)
        : undefined,
      tokenTtlHours: process.env.KELLERHOFF_TOKEN_TTL_HOURS
        ? Number(process.env.KELLERHOFF_TOKEN_TTL_HOURS)
        : undefined
    }
  }
};

export default cfg;
