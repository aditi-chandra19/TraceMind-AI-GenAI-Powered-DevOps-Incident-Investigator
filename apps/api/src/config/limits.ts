const configured = Number(process.env.MAX_UPLOAD_MB ?? 25);
export const maxUploadMb = Number.isInteger(configured) && configured >= 1 && configured <= 100 ? configured : 25;
export const maxUploadBytes = maxUploadMb * 1024 * 1024;
export const maxLogLines = 100_000;
export const maxLogLineBytes = 64 * 1024;
