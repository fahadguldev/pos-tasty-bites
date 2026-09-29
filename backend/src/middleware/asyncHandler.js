// wraps an async route so a rejected promise reaches the error handler
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
