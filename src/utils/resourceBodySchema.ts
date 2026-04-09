import type { Knex } from "knex";
import { z } from "zod";

export type ResourceColumnMap = Record<string, Knex.ColumnInfo>;

function zodForPgColumn(info: Knex.ColumnInfo): z.ZodTypeAny {
    const t = (info.type || "").toLowerCase();

    if (t.includes("bool")) {
        return z.coerce.boolean();
    }
    if (
        t.includes("int") ||
        t === "bigint" ||
        t === "smallint" ||
        t === "serial" ||
        t.includes("serial")
    ) {
        return z.coerce.number().int();
    }
    if (
        t.includes("double") ||
        t.includes("numeric") ||
        t.includes("real") ||
        t.includes("decimal") ||
        t.includes("float") ||
        t.includes("money")
    ) {
        return z.coerce.number();
    }
    if (t.includes("json")) {
        return z.union([
            z.record(z.string(), z.unknown()),
            z.array(z.unknown()),
            z.string(),
            z.number(),
            z.boolean(),
            z.null(),
        ]);
    }
    if (t.includes("timestamp") || t.includes("date") || t === "time") {
        return z.union([z.string(), z.number(), z.date()]);
    }

    return z.string();
}

const SKIP_POST = new Set(["id", "created_at", "updated_at"]);

export function buildResourceBodySchema(
    columnInfo: ResourceColumnMap,
    mode: "post" | "put" | "patch"
): z.ZodObject<Record<string, z.ZodTypeAny>> {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [col, info] of Object.entries(columnInfo)) {
        if (mode === "post" && SKIP_POST.has(col)) continue;
        if (
            (mode === "put" || mode === "patch") &&
            (col === "id" || col === "created_at" || col === "updated_at")
        ) {
            continue;
        }

        let base = zodForPgColumn(info);

        if (mode === "post") {
            const serverCanSet = col === "user_id";
            if (info.nullable === true || serverCanSet) {
                shape[col] = base.optional().nullable();
            } else {
                shape[col] = base;
            }
        } else {
            shape[col] = base.optional().nullable();
        }
    }

    return z.object(shape).strict();
}
