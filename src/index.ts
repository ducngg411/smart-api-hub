import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { runMigration } from './db/migrate';

const PORT = process.env.PORT || 3000;

runMigration()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server tại http://localhost:${PORT}`);
            console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
        });
    })
    .catch((err) => {
        console.error('Migration thất bại', err);
        process.exit(1);
    });
