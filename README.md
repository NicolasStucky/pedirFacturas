# Pedir Facturas - Backend

Backend en Node.js y Express para centralizar las consultas de facturación del proveedor **Suizo**. El objetivo es ofrecer una capa unificada que pueda reutilizarse en otros proyectos.

## Requisitos previos

- Node.js 18 o superior.
- npm (incluido con Node.js).

## Instalación

```bash
npm install
```

Cree un archivo `.env` a partir del `.env.example` y complete las credenciales del proveedor Suizo:

```bash
cp .env.example .env
```

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
| `tcDesde`   | Sí          | Fecha inicial en formato `dd/mm/aaaa`. |
| `tcHasta`   | Sí          | Fecha final en formato `dd/mm/aaaa`. No puede exceder los 7 días respecto a `tcDesde`. |
| `tnEmpresa` | No          | Código de empresa (por defecto `1`). |
| `tcUsuario` | No          | Usuario asignado para el servicio web. |
| `tcClave`   | No          | Clave del usuario. |
| `tcGrupo`   | No          | Grupo de consulta. Valores `G` o `C`. |
| `tnCuenta`  | No          | Código de cuenta específico. |

Los endpoints devuelven el payload enviado al servicio de Suizo y la respuesta interpretada (XML crudo y objeto parseado) para facilitar el consumo en otras capas de la aplicación.

## Arquitectura

- **Express** como framework HTTP.
- **Capas separadas** de controladores, servicios y clientes para facilitar el mantenimiento.
- **Configuración centralizada** en `src/config/index.js`, alimentada por variables de entorno.
- **Cliente SOAP** (`src/clients/suizoClient.js`) para interpretar la respuesta XML del proveedor Suizo.
- **Validaciones de fechas** en `src/utils/date.js` para garantizar el rango máximo de 7 días definido por el proveedor.

## Próximos pasos sugeridos

1. Añadir pruebas automatizadas y autenticación si la aplicación va a exponerse públicamente.
2. Incorporar caché o persistencia según las necesidades del proyecto que consuma este backend.
3. Implementar integraciones para otros proveedores reutilizando la estructura establecida una vez que se disponga de su documentación.
