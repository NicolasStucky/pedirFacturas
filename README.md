# Pedir Facturas - Backend

Backend en Node.js y Express para centralizar las consultas de facturación de distintos proveedores. El objetivo es ofrecer una capa unificada que pueda reutilizarse en otros proyectos.

## Requisitos previos

- Node.js 18 o superior.
- npm (incluido con Node.js).

## Instalación

```bash
npm install
```

Cree un archivo `.env` con las credenciales necesarias para los proveedores disponibles. Consulte la sección de [Configuración](#configuración) para conocer las variables esperadas.

## Ejecución

Modo desarrollo con recarga automática:

```bash
npm run dev
```

Modo producción:

```bash
npm start
```

La aplicación expone por defecto los endpoints en `http://localhost:3000`.

### Página principal

- `GET /`

Devuelve un mensaje de bienvenida junto con un resumen de los endpoints disponibles para que puedas verificar rápidamente la configuración del servicio.

## Endpoints principales

### Salud del servicio

- `GET /health`

### Proveedor Suizo

- `GET /api/providers/suizo/invoices/totals`
- `GET /api/providers/suizo/invoices/details`
- `GET /api/providers/suizo/invoices/perceptions`

Parámetros soportados (query string):

| Parámetro   | Obligatorio | Descripción |
|-------------|-------------|-------------|
| `tcDesde`   | No          | Fecha inicial en formato `dd/mm/aaaa`. Si no se envía, se toma 6 días antes de `tcHasta` (por defecto hoy). |
| `tcHasta`   | No          | Fecha final en formato `dd/mm/aaaa`. El rango efectivo no puede exceder los 7 días corridos. Por defecto es la fecha actual. |
| `tnEmpresa` | No          | Código de empresa (por defecto `1`). |
| `tcUsuario` | No          | Usuario asignado para el servicio web. |
| `tcClave`   | No          | Clave del usuario. |
| `tcGrupo`   | No          | Grupo de consulta. Valores `G` o `C`. |
| `tnCuenta`  | No          | Código de cuenta específico. |

> **Nota:** cuando no se envían `tcDesde` y/o `tcHasta`, el servicio utiliza por defecto el rango de los últimos 7 días corridos contados hasta la fecha actual.

Los endpoints devuelven el payload enviado al servicio de Suizo y la respuesta interpretada (XML crudo y objeto parseado) para facilitar el consumo en otras capas de la aplicación.

### Proveedor Cofarsur

- `GET /api/providers/cofarsur/comprobantes`
- `GET /api/providers/cofarsur/comprobantes/cabecera`
- `GET /api/providers/cofarsur/comprobantes/detalle`
- `GET /api/providers/cofarsur/comprobantes/impuestos`

Parámetros soportados (query string):

| Parámetro        | Obligatorio | Descripción |
|------------------|-------------|-------------|
| `fecha_desde`    | No          | Fecha inicial en formato `dd/mm/aaaa`. Se toma el rango por defecto configurado si no se indica. |
| `fecha_hasta`    | No          | Fecha final en formato `dd/mm/aaaa`. |
| `usuario`        | Sí*         | Usuario cliente de Cofarsur. Se puede definir por query o variable de entorno. |
| `clave`          | Sí*         | Clave del usuario. Se puede definir por query o variable de entorno. |
| `token`          | Sí*         | Token de seguridad provisto por Cofarsur. |

(*) Obligatorio únicamente si no se configuró un valor por defecto en variables de entorno. El rango máximo permitido es configurable mediante `COFARSUR_MAX_RANGE_DAYS` (por defecto 6, es decir 7 días corridos).

La respuesta mantiene la información de estado (`estado`, `mensaje`, `error`) junto con los bloques de `cabecera`, `detalle` e `impuestos` tal como los provee Cofarsur, además del contenido bruto devuelto por el servicio.

## Configuración

Variables relevantes en `.env`:

```bash
# Configuración general
PORT=3000

# Proveedor Suizo
SUIZO_WSDL_URL=...
SUIZO_SOAP_METHOD=ConsultarFacturacion
SUIZO_RESPONSE_FIELD=ConsultarFacturacionResult
SUIZO_EMPRESA=1
SUIZO_USUARIO=webservice
SUIZO_CLAVE=123456
SUIZO_GRUPO=C
SUIZO_CUENTA=123456

# Proveedor Cofarsur
COFARSUR_API_URL=https://ejemplo.cofarsur.com/ws/ExportacionComprobantes
COFARSUR_USUARIO=usuario
COFARSUR_CLAVE=clave
COFARSUR_TOKEN=token
COFARSUR_MAX_RANGE_DAYS=6
```

## Arquitectura

- **Express** como framework HTTP.
- **Capas separadas** de controladores, servicios y clientes para facilitar el mantenimiento.
- **Configuración centralizada** en `src/config/index.js`, alimentada por variables de entorno.
- **Cliente SOAP** (`src/clients/suizoClient.js`) para interpretar la respuesta XML del proveedor Suizo.
- **Cliente HTTP JSON** (`src/clients/cofarsurClient.js`) para interactuar con Cofarsur siguiendo la estructura solicitada por su documentación.
- **Validaciones de fechas** en `src/utils/date.js` para garantizar el rango máximo definido por cada proveedor.

## Próximos pasos sugeridos

1. Añadir pruebas automatizadas y autenticación si la aplicación va a exponerse públicamente.
2. Incorporar caché o persistencia según las necesidades del proyecto que consuma este backend.
3. Implementar nuevas integraciones para otros proveedores reutilizando la estructura establecida.
