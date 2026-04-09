import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { db } from '../src/db/knex';
import { runMigration } from '../src/db/migrate';

// ── Dữ liệu test dùng timestamp để tránh xung đột với data thật ──────────────
const TS = Date.now();
const ADMIN_EMAIL = `admin_${TS}@test.com`;
const USER_EMAIL  = `user_${TS}@test.com`;
const PASSWORD    = 'password123';

let adminToken: string;
let userToken: string;
let createdPostId: number;

// ── Setup / Teardown ──────────────────────────────────────────────────────────
beforeAll(async () => {
    await runMigration();

    // Tạo admin
    await request(app)
        .post('/auth/register')
        .send({ email: ADMIN_EMAIL, password: PASSWORD, role: 'admin' });

    // Tạo user thường
    await request(app)
        .post('/auth/register')
        .send({ email: USER_EMAIL, password: PASSWORD, role: 'user' });

    // Lấy token admin
    const adminRes = await request(app)
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: PASSWORD });
    adminToken = adminRes.body as string;

    // Lấy token user
    const userRes = await request(app)
        .post('/auth/login')
        .send({ email: USER_EMAIL, password: PASSWORD });
    userToken = userRes.body as string;
});

afterAll(async () => {
    if (createdPostId) {
        await db('posts').where({ id: createdPostId }).delete();
    }
    await db('users').whereIn('email', [ADMIN_EMAIL, USER_EMAIL]).delete();
    await db.destroy();
});

// ── Test Cases ────────────────────────────────────────────────────────────────

describe('1. Health Check', () => {
    it('GET /health → 200 và database connected', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.database).toBe('connected');
    });
});

describe('2. Auth — Happy Path', () => {
    it('POST /auth/register với dữ liệu hợp lệ → 200', async () => {
        const unique = `reg_${TS}@test.com`;
        const res = await request(app)
            .post('/auth/register')
            .send({ email: unique, password: PASSWORD });
        expect(res.status).toBe(200);
        expect(res.body.email).toBe(unique);
        // Cleanup
        await db('users').where({ email: unique }).delete();
    });

    it('POST /auth/login với credentials đúng → 200 và trả về token string', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ email: USER_EMAIL, password: PASSWORD });
        expect(res.status).toBe(200);
        expect(typeof res.body).toBe('string');
        expect(res.body.length).toBeGreaterThan(10);
    });
});

describe('3. Auth — Error Cases', () => {
    it('POST /auth/register với email không hợp lệ → 400', async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({ email: 'not-an-email', password: PASSWORD });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('POST /auth/register với password quá ngắn (< 6 ký tự) → 400', async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({ email: `short_${TS}@test.com`, password: '123' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('POST /auth/register với email đã tồn tại → 400', async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({ email: USER_EMAIL, password: PASSWORD });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('POST /auth/login với password sai → 400', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ email: USER_EMAIL, password: 'wrong_password' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});

describe('4. Resource — Happy Path', () => {
    it('GET /posts (không cần auth) → 200 và có header X-Total-Count', async () => {
        const res = await request(app).get('/posts');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.headers['x-total-count']).toBeDefined();
    });

    it('GET /posts?_page=1&_limit=2 → 200 và trả về tối đa 2 records', async () => {
        const res = await request(app).get('/posts?_page=1&_limit=2');
        expect(res.status).toBe(200);
        expect(res.body.length).toBeLessThanOrEqual(2);
    });

    it('POST /posts với token hợp lệ → 201 và record được tạo', async () => {
        const res = await request(app)
            .post('/posts')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ title: `Test post ${TS}`, content: 'Nội dung test' });
        expect(res.status).toBe(201);
        expect(res.body.title).toBe(`Test post ${TS}`);
        createdPostId = res.body.id as number;
    });

    it('PATCH /posts/:id với token hợp lệ → 200 và field được cập nhật', async () => {
        const res = await request(app)
            .patch(`/posts/${createdPostId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ title: 'Updated title' });
        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Updated title');
    });

    it('DELETE /posts/:id với admin token → 200', async () => {
        const res = await request(app)
            .delete(`/posts/${createdPostId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        createdPostId = 0; // Đã xoá, không cần cleanup
    });
});

describe('5. Resource — Error Cases', () => {
    it('POST /posts không có token → 401', async () => {
        const res = await request(app)
            .post('/posts')
            .send({ title: 'No auth', content: 'test' });
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    it('DELETE /posts/:id với user thường (không phải admin) → 403', async () => {
        const res = await request(app)
            .delete('/posts/1')
            .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error');
    });

    it('GET /nonexistent_table → 404', async () => {
        const res = await request(app).get('/nonexistent_table');
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
    });

    it('GET /posts/abc (id không phải số) → 400', async () => {
        const res = await request(app).get('/posts/abc');
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});
