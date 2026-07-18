export class ValidationError extends Error {
	constructor(message) {
		super(message);
		this.name = 'ValidationError';
		this.statusCode = 400;
	}
}

export function requireString(value, field, { minLen = 1, maxLen = 10_000 } = {}) {
	if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`);
	const trimmed = value.trim();
	if (trimmed.length < minLen) throw new ValidationError(`${field} is too short`);
	if (trimmed.length > maxLen) throw new ValidationError(`${field} must be ${maxLen} characters or fewer`);
	return trimmed;
}

export function optionalString(value, field, opts = {}) {
	if (value === undefined || value === null || value === '') return '';
	return requireString(value, field, { minLen: 0, ...opts });
}

export function toBoolean(value) {
	return value === true || value === 'true' || value === 1 || value === '1';
}

export function requireUsername(value) {
	const v = requireString(value, 'username', { minLen: 1, maxLen: 64 });
	if (!/^[a-zA-Z0-9_.-]+$/.test(v)) {
		throw new ValidationError('username may only contain letters, numbers, "_", "." and "-"');
	}
	return v;
}

export function requirePassword(value) {
	if (typeof value !== 'string') throw new ValidationError('password must be a string');
	if (value.length < 1 || value.length > 512) throw new ValidationError('invalid password');
	return value;
}

export function requireId(value, field = 'id') {
	const n = Number(value);
	if (!Number.isInteger(n) || n <= 0) throw new ValidationError(`${field} must be a positive integer`);
	return n;
}
