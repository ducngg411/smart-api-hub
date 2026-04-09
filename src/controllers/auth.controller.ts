import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from "../config/jwt";
import { db } from "../db/knex";

// Register
export async function register(req: Request, res: Response) {
    const { email, password, role } = req.body;

    const existing = await db('users').where({ email }).first();
    if (existing) {
        return res.status(400).json({ error: 'Email đã được sử dụng' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await db('users')
        .insert({
            email, 
            password: hashedPassword, 
            role: role || 'user'
        }).returning(['id', 'email', 'role']);
    
    return res.status(200).json(newUser);
}

// Login
export async function login(req: Request, res: Response) {
    const { email, password } = req.body;
    
    const user = await db('users').where({ email }).first();

    if (!user) {
        return res.status(400).json({ error: 'Email hoặc Password không hợp lệ'})
    }

    const compare = await bcrypt.compare(password, user.password);

    if (!compare) {
        return res.status(400).json({ error: 'Email hoặc Password không hợp lệ'})
    }

    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role},
        JWT_SECRET, 
        {expiresIn: '1d'}
    );

    return res.status(200).json(token);
};