import fs from 'fs';
import path from 'path';
import { db } from './knex';

function inferColumnType (value: unknown) {
    if (typeof value === "boolean") return "boolean";
    if (typeof value === "number") return Number.isInteger(value) ? "integer" : "float";
    return "text";
};

async function ensureAuditLogsTable() {
    const exists = await db.schema.hasTable('audit_logs');
    if (!exists) {
        await db.schema.createTable('audit_logs', (table) => {
            table.increments('id');
            table.integer('user_id').nullable();
            table.text('action').notNullable();
            table.text('resource_name').notNullable();
            table.integer('record_id').notNullable();
            table.timestamp('timestamp').defaultTo(db.fn.now()).notNullable();
        });
        console.log('Tạo bảng: audit_logs');
    }
}

export async function runMigration() {
    await ensureAuditLogsTable();

    const schemaPath = path.join(process.cwd(), 'schema.json');
    const raw = fs.readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(raw) as Record<string, Record<string, unknown>[]>;

    for (const [tableName, rows] of Object.entries(schema)) {
        const exists = await db.schema.hasTable(tableName);
        
        if (!exists) {
            const sample = rows[0];
            if (!sample) continue 

            await db.schema.createTable(tableName, (table) => {
                table.increments('id');

                Object.entries(sample).forEach(([col, val]) => {
                    if (col === 'id') return; 
                    const colType = inferColumnType(val);

                    if (colType === 'integer') table.integer(col);
                    else if (colType === 'float') table.float(col);
                    else if (colType === 'boolean') table.boolean(col);
                    else table.text(col)
                }); 
                
                table.timestamps(true, true); // created_at, updated_at
            });
            console.log(`Tạo bảng: ${tableName}`)
        } else {
            console.log(`Bỏ qua bảng: ${tableName} đã tồn tại!`)
        }

        // Seed data 
        if (rows.length > 0) {
            let insertedCount = 0;
            for (const row of rows) {
                const existed = await db(tableName).where(row).first();
                if (!existed) {
                    await db(tableName).insert(row);
                    insertedCount += 1;
                }
            }
            if (insertedCount > 0) {
                console.log(`Seed ${insertedCount} record mới vào ${tableName}`);
            } else {
                console.log(`Không có record mới cho ${tableName}`);
            }
        }
    }
}

