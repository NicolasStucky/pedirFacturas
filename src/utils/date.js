const DATE_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function toUTCMidnight(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getEarliestAllowed(maxDays) {
  const today = toUTCMidnight();
  const earliest = new Date(today);
  earliest.setUTCDate(today.getUTCDate() - maxDays);
  return earliest;
}

export function formatToDDMMYYYY(date) {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

export function parseDDMMYYYY(input) {
  if (typeof input !== 'string') {
    throw new Error('Formato de fecha inválido, debe ser una cadena');
  }

  const match = input.match(DATE_REGEX);

  if (!match) {
    throw new Error('Formato de fecha inválido, debe ser dd/mm/aaaa');
  }

  const [, dayStr, monthStr, yearStr] = match;
  const day = Number(dayStr);
  const month = Number(monthStr) - 1;
  const year = Number(yearStr);

  const date = new Date(Date.UTC(year, month, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error('Fecha inválida');
  }

  return date;
}

export function diffInDays(from, to) {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export function ensureMaxRange(desde, hasta, maxDays) {
  const start = parseDDMMYYYY(desde);
  const end = parseDDMMYYYY(hasta);

  if (end < start) {
    const error = new Error('tcHasta debe ser igual o posterior a tcDesde');
    error.status = 400;
    throw error;
  }

  const diff = diffInDays(start, end);

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
  const end = toUTCMidnight();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 1);

  const earliestAllowed = getEarliestAllowed(maxDays);
  if (start < earliestAllowed) {
    return {
      desde: formatToDDMMYYYY(earliestAllowed),
      hasta: formatToDDMMYYYY(end)
    };
  }

  return {
    desde: formatToDDMMYYYY(start),
    hasta: formatToDDMMYYYY(end)
  };
}

export default {
  parseDDMMYYYY,
  diffInDays,
  ensureMaxRange,
  getDefaultRange,
  formatToDDMMYYYY
};
