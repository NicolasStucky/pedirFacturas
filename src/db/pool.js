import mysql from 'mysql2/promise';
import config from '../config/index.js';

let pool;

function resolvePoolConfig() {
  const db = config.database ?? {};

  if (!db.host || !db.user || !db.name) {
    const error = new Error(
      'Debe configurar DB_HOST, DB_USER y DB_NAME para acceder a las credenciales de las sucursales'
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

export function getPool() {
  if (!pool) {
    pool = mysql.createPool(resolvePoolConfig());
  }
  return pool;
}

export default getPool;
