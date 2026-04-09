/** Dùng chung cho sign (login) và verify (middleware) — tránh lệch default giữa các file. */
export const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";
