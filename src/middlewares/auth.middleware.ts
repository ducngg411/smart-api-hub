import { Request, Response, NextFunction } from "express";
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from "../config/jwt";

export interface AuthRequest extends Request {
    user?: { id: number; email: string; role: string};
}

// Middleware 
export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  // Authorization: Bearer <token>"
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Không có token xác thực' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthRequest['user'];
        req.user = decoded; 
        next(); 
    } catch {
        return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }
}

// Admin (khớp cả "admin" trong DB seed và "Admin")
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    const role = req.user?.role?.toLowerCase();
    if (role !== "admin") {
        return res.status(403).json({ error: 'Chỉ có Admin mới có quyền thực hiện' });
    }
    next();
}