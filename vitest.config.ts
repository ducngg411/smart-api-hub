import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        testTimeout: 15000,
        hookTimeout: 20000,
        include: ['tests/**/*.test.ts'],
        globals: false,
    },
});
