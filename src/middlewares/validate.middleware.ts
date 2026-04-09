import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { db } from "../db/knex";
import { tableExists } from "../utils/tableValidator";
import { buildResourceBodySchema } from "../utils/resourceBodySchema";

function formatZodIssues(err: ZodError): string {
    return err.issues
        .map((i) => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`)
        .join("; ");
}

export function validate(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: formatZodIssues(parsed.error) });
        }
        req.body = parsed.data;
        next();
    };
}

export function validateResourceBody(mode: "post" | "put" | "patch") {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const resource = String(
                Array.isArray(req.params.resource)
                    ? req.params.resource[0]
                    : req.params.resource
            );
            if (!(await tableExists(resource))) {
                return res.status(404).json({ error: `Bảng ${resource} không tồn tại` });
            }

            const columnInfo = await db(resource).columnInfo();
            const schema = buildResourceBodySchema(columnInfo, mode);
            const raw = req.body ?? {};
            const parsed = schema.safeParse(raw);

            if (!parsed.success) {
                return res.status(400).json({ error: formatZodIssues(parsed.error) });
            }

            req.body = parsed.data;
            next();
        } catch (err) {
            next(err);
        }
    };
}
