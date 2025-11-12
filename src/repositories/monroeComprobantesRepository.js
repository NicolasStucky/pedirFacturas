import { getPool } from '../db/pool.js';

function mapResultsToRows(results = []) {
  const rows = [];

  for (const entry of results) {
    const branch = typeof entry?.branch === 'string' ? entry.branch.trim() : '';
    if (!branch) continue;

    const data = Array.isArray(entry?.data) ? entry.data : [];
    for (const item of data) {
      rows.push([
        branch,
        item?.customer_reference ?? null,
        item?.fecha ?? null,
        item?.codigo_busqueda ?? null,
      ]);
    }
  }

  return rows;
}

export async function replaceAllMonroeComprobantes(results) {
  const rows = mapResultsToRows(results);
  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM comprobantes_monroe');

    if (rows.length > 0) {
      await connection.query(
        `
          INSERT INTO comprobantes_monroe
            (comprobante_id, customer_reference, fecha, codigo_busqueda)
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

export default {
  replaceAllMonroeComprobantes,
};
