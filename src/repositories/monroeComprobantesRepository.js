import { getMonroePool } from '../db/monroePool.js';
import { formatToISODate } from '../utils/isoDate.js';

function mapResultsToRows(results = []) {
  const rows = [];

  for (const entry of results) {
    const data = Array.isArray(entry?.data) ? entry.data : [];
    for (const item of data) {
      const fechaNormalizada = normalizeFechaToMySQL(item?.fecha ?? null);

      rows.push([
        item?.customer_reference ?? null,
        fechaNormalizada,
        item?.codigo_busqueda ?? null,
      ]);
    }
  }

  return rows;
}

export async function replaceAllMonroeComprobantes(results) {
  const rows = mapResultsToRows(results);
  const pool = await getMonroePool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM comprobantes_monroe');

    if (rows.length > 0) {
      await connection.query(
        `
          INSERT INTO comprobantes_monroe
            (customer_reference, fecha, codigo_busqueda)
          VALUES ?
        `,
        [rows]
      );
    }

    await connection.commit();
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {
      // ignore rollback errors
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function listStoredMonroeComprobantes() {
  const pool = await getMonroePool();
  const [rows] = await pool.query(
    `
      SELECT customer_reference, fecha, codigo_busqueda
      FROM comprobantes_monroe
    `
  );

  return rows.map((row) => ({
    customer_reference: row?.customer_reference ?? null,
    fecha: row?.fecha ? formatToISODate(row.fecha) : null,
    codigo_busqueda: row?.codigo_busqueda ?? null,
  }));
}

export default {
  replaceAllMonroeComprobantes,
  listStoredMonroeComprobantes,
};
