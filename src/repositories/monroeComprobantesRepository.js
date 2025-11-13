import { getMonroePool } from '../db/monroePool.js';
import { formatToISODate } from '../utils/isoDate.js';

const DD_MM_YYYY_REGEX =
  /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/;

function normalizeFechaToMySQL(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return formatToISODate(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const match = trimmed.match(DD_MM_YYYY_REGEX);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }

    try {
      return formatToISODate(trimmed);
    } catch (_) {
      return null;
    }
  }

  try {
    return formatToISODate(value);
  } catch (_) {
    return null;
  }
}

function mapResultsToRows(results = []) {
  const rows = [];

  for (const entry of results) {
    const data = Array.isArray(entry?.data) ? entry.data : [];
    for (const item of data) {
      rows.push([
        item?.customer_reference ?? null,
        normalizeFechaToMySQL(item?.fecha),
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
