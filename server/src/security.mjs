export class HttpError extends Error {
  constructor(status, message, code = 'request_error', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function requireOwner(req) {
  const ownerId = req.headers['x-placementiq-owner'];
  if (typeof ownerId !== 'string' || !/^[a-zA-Z0-9_-]{24,128}$/.test(ownerId)) {
    throw new HttpError(401, 'This device identity is missing or invalid.', 'owner_required');
  }
  return ownerId;
}

export function cleanText(value, maxLength, field = 'text') {
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text.`, 'invalid_input');
  const text = value.replace(/\u0000/g, '').trim();
  if (!text) throw new HttpError(400, `${field} cannot be empty.`, 'invalid_input');
  if (text.length > maxLength) throw new HttpError(413, `${field} exceeds the ${maxLength.toLocaleString()} character limit.`, 'input_too_large');
  return text;
}

export function asArray(value, maxItems = 20) {
  return Array.isArray(value) ? value.slice(0, maxItems) : [];
}
