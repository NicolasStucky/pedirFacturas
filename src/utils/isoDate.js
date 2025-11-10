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

export function formatToISO8601(date) {
  return new Date(date).toISOString();
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

  return parsed;
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
  if (start < earliestAllowed) {
    return {
      desde: formatToISO8601(earliestAllowed),
      hasta: formatToISO8601(end)
    };
  }

  return {
    desde: formatToISO8601(start),
    hasta: formatToISO8601(end)
  };
}

export default {
  parseISO8601,
  ensureMaxRange,
  getDefaultRange,
  formatToISO8601
};
