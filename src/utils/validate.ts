import { z } from "zod";

export const registerSchema = z.object({
    email: z.string().trim().email({ message: "Email không hợp lệ" }),
    password: z.string().min(6, { message: "Password phải có ít nhất 6 ký tự" }),
    role: z.enum(["user", "admin"]).optional().default("user"),
});

export const loginSchema = z.object({
    email: z.string().trim().email({ message: "Email không hợp lệ" }),
    password: z.string().min(1, { message: "Password không được để trống" }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
