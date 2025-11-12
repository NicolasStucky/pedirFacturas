import { getPool } from '../db/pool.js';

const cache = new Map();
let monroeBranchesCache;

export function normalizeBranchCode(branchCode) {
  if (branchCode == null) return null;
  const trimmed = String(branchCode).trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, '').toUpperCase();
}

function mapRowToCredentials(row) {
  return {
    branchCode: row.sucursal_codigo,
    quantio: {
      usuario: row.quantio_usuario ?? undefined,
      clave: row.quantio_clave ?? undefined,
    },
    monroe: {
      cuenta: row.monroe_cuenta ?? undefined,
      ecommerceKey: row.monroe_ecommerce_key ?? undefined,
      softwareKey: row.monroe_software_key ?? undefined,
    },
    cofarsur: {
      usuario: row.cofarsur_usuario ?? undefined,
      clave: row.cofarsur_clave ?? undefined,
      token: row.cofarsur_token ?? undefined,
    },
    suizo: {
      usuario: row.suizo_usuario ?? undefined,
      clave: row.suizo_clave ?? undefined,
      cuenta: row.suizo_cliente ?? undefined,
    },
    kellerhoff: {
      usuario: row.kellerhof_usuario ?? undefined,
      clave: row.kellerhof_clave ?? undefined,
      cliente: row.kellerhof_cliente ?? undefined,
    },
  };
}

export async function getBranchCredentials(branchCode) {
  const normalized = normalizeBranchCode(branchCode);

  if (!normalized) {
    const error = new Error('Debe indicar el código de sucursal en la ruta (por ejemplo /sa1)');
    error.status = 400;
    throw error;
  }

  if (cache.has(normalized)) {
    return cache.get(normalized);
  }

  const pool = await getPool();
  const [rows] = await pool.execute(
    `
      SELECT
        sucursal_codigo,
        quantio_usuario,
        quantio_clave,
        monroe_cuenta,
        monroe_ecommerce_key,
        monroe_software_key,
        cofarsur_usuario,
        cofarsur_clave,
        cofarsur_token,
        suizo_usuario,
        suizo_clave,
        suizo_cliente,
        kellerhof_usuario,
        kellerhof_clave,
        kellerhof_cliente
      FROM credenciales_droguerias
      WHERE REPLACE(UPPER(sucursal_codigo), ' ', '') = ?
      LIMIT 1
    `,
    [normalized]
  );

  if (!rows || rows.length === 0) {
    const error = new Error(`No se encontraron credenciales para la sucursal "${branchCode}"`);
    error.status = 404;
    throw error;
  }

  const credentials = mapRowToCredentials(rows[0]);
  cache.set(normalized, credentials);
  return credentials;
}

export async function listMonroeBranches() {
  if (Array.isArray(monroeBranchesCache)) {
    return monroeBranchesCache;
  }

  const pool = await getPool();
  const [rows] = await pool.execute(
    `
      SELECT sucursal_codigo
      FROM credenciales_droguerias
      WHERE monroe_cuenta IS NOT NULL
         OR monroe_ecommerce_key IS NOT NULL
         OR monroe_software_key IS NOT NULL
      ORDER BY sucursal_codigo
    `
  );

  const branches = rows
    .map((row) => normalizeBranchCode(row.sucursal_codigo))
    .filter((code) => Boolean(code));

  monroeBranchesCache = branches;
  return branches;
}

export default {
  getBranchCredentials,
  listMonroeBranches,
};
