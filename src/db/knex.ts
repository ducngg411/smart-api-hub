import knex from "knex";
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config()

pg.types.setTypeParser(20, (val: string) => parseInt(val, 10));

export const db = knex({
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    }
})

