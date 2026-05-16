const parsedLimit = Number.parseInt(process.env.DEFAULT_LIMIT ?? '5000');
export const downloadLimit = Number.isNaN(parsedLimit) ? 5000 : parsedLimit;

const parsedMaxBytes = Number.parseInt(process.env.MAX_RESPONSE_BYTES ?? '10485760'); // 10MB
export const maxResponseBytes = Number.isNaN(parsedMaxBytes) ? 10485760 : parsedMaxBytes;
