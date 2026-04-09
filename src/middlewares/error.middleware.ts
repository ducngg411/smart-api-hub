import { Request, Response, NextFunction } from "express";

/** Lỗi có mã HTTP — dùng `next(new HttpError(400, '...'))` trong controller khi cần. */
export class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
        this.name = "HttpError";
    }
}

export interface AppError extends Error {
    statusCode?: number;
}

function getStatusCode(err: unknown): number {
    if (err instanceof HttpError) return err.statusCode;
    if (typeof err === "object" && err !== null && "statusCode" in err) {
        const sc = (err as AppError).statusCode;
        if (typeof sc === "number" && sc >= 400 && sc < 600) return sc;
    }
    return 500;
}

function getClientMessage(err: unknown, statusCode: number): string {
    const prod = process.env.NODE_ENV === "production";
    if (statusCode >= 500 && prod) {
        return "Internal Server Error";
    }
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === "string") return err;
    return "Internal Server Error";
}

/** Phải đăng ký sau mọi route; Express nhận diện middleware 4 tham số (err, req, res, next). */
export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    next: NextFunction
) {
    if (res.headersSent) {
        return next(err);
    }

    const statusCode = getStatusCode(err);
    const message = getClientMessage(err, statusCode);

    console.error(err);

    return res.status(statusCode).json({ error: message });
}
