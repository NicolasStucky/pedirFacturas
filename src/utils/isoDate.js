const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcMidnight(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getEarliestAllowed(maxDays) {
  const today = toUtcMidnight();
  const earliest = new Date(today);
  earliest.setUTCDate(today.getUTCDate() - maxDays);
  return earliest;
}

export function formatToISODate(date) {
  const asDate = new Date(date);
  if (Number.isNaN(asDate.getTime())) {
    const error = new Error('Fecha inválida, no se puede formatear a ISO');
    error.status = 400;
    throw error;
  }

  const midnight = toUtcMidnight(asDate);
  const year = midnight.getUTCFullYear();
  const month = String(midnight.getUTCMonth() + 1).padStart(2, '0');
  const day = String(midnight.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function parseISO8601(input) {
  if (typeof input !== 'string') {
    const error = new Error('La fecha debe ser una cadena en formato ISO 8601');
    error.status = 400;
    throw error;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    const error = new Error('La fecha no puede estar vacía');
    error.status = 400;
    throw error;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error('Formato de fecha inválido, debe ser ISO 8601');
    error.status = 400;
    throw error;
  }

  return toUtcMidnight(parsed);
}

export function ensureMaxRange(desde, hasta, maxDays = 6) {
  const start = parseISO8601(desde);
  const end = parseISO8601(hasta);

  if (end < start) {
    const error = new Error('fechaHasta debe ser igual o posterior a fechaDesde');
    error.status = 400;
    throw error;
  }

  const diff = (end.getTime() - start.getTime()) / MS_PER_DAY;
  if (diff > maxDays) {
    const error = new Error(`El rango de fechas no puede superar los ${maxDays + 1} días`);
    error.status = 400;
    throw error;
  }

  const earliestAllowed = getEarliestAllowed(maxDays);
  if (start < earliestAllowed) {
    const error = new Error(`Solo se admiten fechas dentro de los últimos ${maxDays} días`);
    error.status = 400;
    throw error;
  }

  return { start, end };
}

export function getDefaultRange(maxDays = 6) {
  const end = toUtcMidnight();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 1);

  const earliestAllowed = getEarliestAllowed(maxDays);
  const normalizedStart = start < earliestAllowed ? earliestAllowed : start;
  const normalizedEnd = end < normalizedStart ? normalizedStart : end;

  return {
    desde: formatToISODate(normalizedStart),
    hasta: formatToISODate(normalizedEnd)
  };
}

export default {
  parseISO8601,
  ensureMaxRange,
  getDefaultRange,
  formatToISODate
};
