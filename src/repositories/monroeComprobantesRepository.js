import { getMonroePool } from '../db/monroePool.js';
import { formatToISODate } from '../utils/isoDate.js';

/**
 * Normaliza fechas de Monroe al formato que entiende MySQL (YYYY-MM-DD HH:MM:SS)
 */
function normalizeFechaToMySQL(raw) {
  if (!raw) return null;
  if (raw instanceof Date) {
    // YYYY-MM-DD HH:MM:SS a partir de Date (sin zona complicada)
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    const hh = String(raw.getHours()).padStart(2, '0');
    const mm = String(raw.getMinutes()).padStart(2, '0');
    const ss = String(raw.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }

  const fecha = String(raw).trim();
  if (!fecha) return null;

  // 01/10/2025
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) {
    const [dd, mm, yyyy] = fecha.split('/');
    return `${yyyy}-${mm}-${dd} 00:00:00`;
  }

  // 01/10/2025 13:45 o 01/10/2025 13:45:30
  if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(:\d{2})?$/.test(fecha)) {
    const [datePart, timePartRaw] = fecha.split(/\s+/);
    const [dd, mm, yyyy] = datePart.split('/');
    let timePart = timePartRaw;
    if (timePart.split(':').length === 2) {
      timePart = `${timePart}:00`;
    }
    return `${yyyy}-${mm}-${dd} ${timePart}`;
  }

  // 2025-10-01
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return `${fecha} 00:00:00`;
  }

  // 2025-10-01T13:45 o 2025-10-01 13:45:30
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(fecha)) {
    const normalized = fecha.replace('T', ' ');
    const [datePart, timePartRaw] = normalized.split(' ');
    let timePart = timePartRaw;
    if (timePart.split(':').length === 2) {
      timePart = `${timePart}:00`;
    }
    return `${datePart} ${timePart}`;
  }

  // Cualquier otro formato raro: lo dejamos como viene
  // (si no lo entiende MySQL, volverá a dar error y lo afinamos)
  return fecha;
}

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
