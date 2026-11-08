export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error('[Server Error]:', err);

  // Mongoose Bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with id ${err.value}`;
    return res.status(404).json({ success: false, message });
  }

  // Mongoose Duplicate Key (e.g. unique username or email)
  if (err.code === 11000) {
    const field = err.keyValue
      ? Object.keys(err.keyValue)[0]
      : err.keyPattern
        ? Object.keys(err.keyPattern)[0]
        : 'field';
    const message = `A record with that ${field} already exists.`;
    return res.status(400).json({ success: false, message, field });
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({ success: false, message });
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
  });
};
