const DATE_REGEX =
  /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/;

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

  const trimmed = input.trim();
  const match = trimmed.match(DATE_REGEX);

  if (!match) {
    throw new Error('Formato de fecha inválido, debe ser dd/mm/aaaa');
  }

  const [, dayStr, monthStr, yearStr, hourStr, minuteStr, secondStr] = match;
  const day = Number(dayStr);
  const month = Number(monthStr) - 1;
  const year = Number(yearStr);
  const hours = hourStr === undefined ? 0 : Number(hourStr);
  const minutes = minuteStr === undefined ? 0 : Number(minuteStr);
  const seconds = secondStr === undefined ? 0 : Number(secondStr);

  if (
    hours < 0 || hours > 23 ||
    minutes < 0 || minutes > 59 ||
    seconds < 0 || seconds > 59
  ) {
    throw new Error('Hora inválida en la fecha proporcionada');
  }

  const date = new Date(Date.UTC(year, month, day, hours, minutes, seconds));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hours ||
    date.getUTCMinutes() !== minutes ||
    date.getUTCSeconds() !== seconds
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
  const normalizedStart = start < earliestAllowed ? earliestAllowed : start;

  const normalizedEnd = end < normalizedStart ? normalizedStart : end;

  return {
    desde: formatToDDMMYYYY(normalizedStart),
    hasta: formatToDDMMYYYY(normalizedEnd)
  };
}

export default {
  parseDDMMYYYY,
  diffInDays,
  ensureMaxRange,
  getDefaultRange,
  formatToDDMMYYYY
};
