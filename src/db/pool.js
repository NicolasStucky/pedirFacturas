import config from '../config/index.js';

let poolPromise;

async function importMysql() {
  try {
    const mysqlModule = await import('mysql2/promise');
    return mysqlModule.default ?? mysqlModule;
  } catch (error) {
    const err = new Error(
      'No se encontró la dependencia "mysql2". Ejecuta "npm install" para instalarla antes de iniciar el servidor.'
    );
    err.status = 500;
    err.cause = error;
    throw err;
  }
}

function resolvePoolConfig() {
  const db = config.database ?? {};

  if (!db.host || !db.user || !db.name) {
    const error = new Error(
      'Debe configurar DB_HOST_MONROE, DB_USER_MONROE y DB_NAME_MONROE para acceder a las credenciales de las sucursales'
    );
    error.status = 500;
    throw error;
  }

  return {
    host: db.host,
    port: db.port ?? 3306,
    user: db.user,
    password: db.password,
    database: db.name,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
}

export async function getPool() {
  if (!poolPromise) {
    poolPromise = (async () => {
      const mysql = await importMysql();
      return mysql.createPool(resolvePoolConfig());
    })();
  }

  return poolPromise;
}

export default getPool;
