export function notFoundHandler(_req, res) {
  res.status(404).json({
    message: 'Recurso no encontrado'
  });
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status ?? 500;
  const message = err.message ?? 'Error interno del servidor';
  const details = err.details ?? undefined;

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('Error interno:', err);
  }

  res.status(status).json({
    message,
    ...(details ? { details } : {})
  });
}
