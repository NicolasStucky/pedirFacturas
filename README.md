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

### Proveedor Monroe Americana

- `GET /api/providers/monroe/comprobantes`
- `GET /api/providers/monroe/comprobantes/:comprobanteId`

Parámetros soportados en la consulta general (`/comprobantes`):

| Parámetro                    | Obligatorio | Descripción |
|------------------------------|-------------|-------------|
| `fechaDesde` / `fecha_desde` | No          | Fecha inicial en formato ISO 8601 (por ejemplo `2024-04-06T00:00:00.000Z`). Si no se envía se usa el rango por defecto (últimos 7 días corridos). |
| `fechaHasta` / `fecha_hasta` | No          | Fecha final en formato ISO 8601. Debe respetar el rango máximo de 7 días corridos. |
| `nro_comprobante`            | No          | Número completo del comprobante (`0001-00000001`). |
| `tipo`                       | No          | Tipo de comprobante (por ejemplo `FC`). |
| `letra`                      | No          | Letra del comprobante (por ejemplo `A`). |
| `software_key`               | Sí*         | Clave del desarrollador provista por Monroe. |
| `ecommerce_customer_key`     | Sí*         | Clave asignada al cliente/punto de venta. |
| `ecommerce_customer_reference` | Sí*       | GLN/CUFE o identificador de domicilio. |
| `token_duration`             | No          | Duración del token (en minutos). |

Parámetros marcados con `*` son obligatorios únicamente si no se configuraron en variables de entorno. El servicio obtiene el token de manera automática utilizando `Auth/login`, lo cachea en memoria hasta su caducidad y lo adjunta en el encabezado `Authorization` de cada petición.

El endpoint de detalle (`/comprobantes/:comprobanteId`) espera en la ruta el identificador completo del comprobante (por ejemplo `FC-A-1103-01522760`) y reutiliza las mismas credenciales/query parameters para autenticarse.

### Proveedor Kellerhoff

- `POST /api/providers/kellerhoff/products`

Envía en el cuerpo de la petición (`application/json`) el listado de productos a consultar junto con la farmacia asociada. Ejemplo:

```json
{
  "pharmacy": { "reference": 8229 },
  "products": [
    { "codebar": "7797811099431", "quantity": 3 },
    { "codebar": "7795327060082", "quantity": 1 }
  ]
}
```

El servicio obtiene automáticamente el token de Kellerhoff utilizando el endpoint `quantiocloud/token` y lo reutiliza hasta su caducidad (12 horas por defecto).
Podés sobreescribir las credenciales configuradas en el entorno enviando `email` y `password` en el cuerpo de la petición.
El campo `pharmacy.reference` es obligatorio si no se configuró `KELLERHOFF_PHARMACY_REFERENCE`.
La respuesta devuelve el payload enviado y el objeto retornado por Kellerhoff (`status`, `message`, `data.productos`, etc.).

## Configuración

Variables relevantes en `.env`:

```bash
# Generales
PORT=3000

# Suizo
SUIZO_WSDL_URL=
SUIZO_SOAP_METHOD=
SUIZO_RESPONSE_FIELD=
SUIZO_EMPRESA=
SUIZO_USUARIO=
SUIZO_CLAVE=
SUIZO_GRUPO=
SUIZO_CUENTA=

# Cofarsur
COFARSUR_WSDL_URL=
COFARSUR_USUARIO=
COFARSUR_CLAVE=
COFARSUR_TOKEN=
COFARSUR_MAX_RANGE_DAYS=6

# Monroe Americana
MONROE_BASE_URL=
MONROE_ADE_VERSION=ade/1.0.0
MONROE_SOFTWARE_KEY=
MONROE_CUSTOMER_KEY=
MONROE_CUSTOMER_REFERENCE=
MONROE_TOKEN_DURATION=

# Kellerhoff
KELLERHOFF_BASE_URL=
KELLERHOFF_EMAIL=
KELLERHOFF_PASSWORD=
KELLERHOFF_PHARMACY_REFERENCE=
# Opcionales
# KELLERHOFF_TIMEOUT=15000
# KELLERHOFF_TOKEN_TTL_HOURS=12
```

## Arquitectura

- **Express** como framework HTTP.
- **Capas separadas** de controladores, servicios y clientes para facilitar el mantenimiento.
- **Configuración centralizada** en `src/config/index.js`, alimentada por variables de entorno.
- **Cliente SOAP** (`src/clients/suizoClient.js`) para interpretar la respuesta XML del proveedor Suizo.
- **Cliente HTTP JSON** (`src/clients/cofarsurClient.js`) para interactuar con Cofarsur siguiendo la estructura solicitada por su documentación.
- **Cliente HTTP JSON** (`src/clients/kellerhoffClient.js`) para autenticarse y consultar productos en Kellerhoff.
- **Validaciones de fechas** en `src/utils/date.js` para garantizar el rango máximo definido por cada proveedor.

## Próximos pasos sugeridos

1. Añadir pruebas automatizadas y autenticación si la aplicación va a exponerse públicamente.
2. Incorporar caché o persistencia según las necesidades del proyecto que consuma este backend.
3. Implementar nuevas integraciones para otros proveedores reutilizando la estructura establecida.
