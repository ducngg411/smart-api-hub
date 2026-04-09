import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { db } from './db/knex';
import resourceRouter from './routes/resource.routes';
import authRouter from './routes/auth.routes';
import { errorHandler } from './middlewares/error.middleware';
import { swaggerSpec } from './config/swagger';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.use('/', authRouter);

app.get('/', (_req, res) => {
    res.json({ message: 'Smart API Hub đang chạy!' });
});

app.get('/health', async (_req, res) => {
    try {
        await db.raw('SELECT 1');
        res.json({ status: 'ok', database: 'connected', uptime: process.uptime() });
    } catch {
        res.status(503).json({ status: 'error', database: 'disconnected' });
    }
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/', resourceRouter);

app.use(errorHandler);

export default app;
