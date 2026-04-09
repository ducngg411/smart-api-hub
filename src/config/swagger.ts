export const swaggerSpec = {
    openapi: '3.0.3',
    info: {
        title: 'Smart API Hub',
        version: '1.0.0',
        description:
            'REST API Platform tự động sinh API từ `schema.json`. ' +
            'Hỗ trợ Dynamic CRUD, Advanced Query, Relationships, Auth & Authorization.',
    },
    servers: [
        {
            url: process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`,
            description: process.env.RENDER_EXTERNAL_URL ? 'Production (Render)' : 'Local',
        },
    ],
    components: {
        securitySchemes: {
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
        schemas: {
            Error: {
                type: 'object',
                properties: { error: { type: 'string', example: 'Mô tả lỗi' } },
            },
        },
    },
    paths: {
        '/health': {
            get: {
                tags: ['System'],
                summary: 'Health check + DB ping',
                responses: {
                    '200': {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', example: 'ok' },
                                        database: { type: 'string', example: 'connected' },
                                        uptime: { type: 'number', example: 42.5 },
                                    },
                                },
                            },
                        },
                    },
                    '503': { description: 'DB không kết nối được' },
                },
            },
        },
        '/auth/register': {
            post: {
                tags: ['Auth'],
                summary: 'Đăng ký tài khoản mới',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'password'],
                                properties: {
                                    email: { type: 'string', format: 'email', example: 'user@example.com' },
                                    password: { type: 'string', minLength: 6, example: 'secret123' },
                                    role: { type: 'string', enum: ['user', 'admin'], default: 'user' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Tạo user thành công' },
                    '400': { description: 'Validation lỗi hoặc email đã tồn tại', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'Đăng nhập, nhận JWT token',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'password'],
                                properties: {
                                    email: { type: 'string', format: 'email', example: 'user@example.com' },
                                    password: { type: 'string', example: 'secret123' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'JWT token (string)' },
                    '400': { description: 'Sai email hoặc password', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/{resource}': {
            get: {
                tags: ['Dynamic CRUD'],
                summary: 'Lấy danh sách resource',
                parameters: [
                    { name: 'resource', in: 'path', required: true, schema: { type: 'string' }, example: 'posts' },
                    { name: '_fields', in: 'query', schema: { type: 'string' }, description: 'Chọn cột trả về, vd: id,title' },
                    { name: '_page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: '_limit', in: 'query', schema: { type: 'integer', default: 10 } },
                    { name: '_sort', in: 'query', schema: { type: 'string', default: 'id' } },
                    { name: '_order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } },
                    { name: '_expand', in: 'query', schema: { type: 'string' }, description: 'Lấy dữ liệu bảng cha, vd: users' },
                    { name: '_embed', in: 'query', schema: { type: 'string' }, description: 'Lấy dữ liệu bảng con, vd: comments' },
                    { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Tìm kiếm toàn văn trên các cột text' },
                    { name: '<col>_gte', in: 'query', schema: { type: 'string' }, description: 'Lọc: >= giá trị, vd: id_gte=5' },
                    { name: '<col>_lte', in: 'query', schema: { type: 'string' }, description: 'Lọc: <= giá trị' },
                    { name: '<col>_ne', in: 'query', schema: { type: 'string' }, description: 'Lọc: khác giá trị' },
                    { name: '<col>_like', in: 'query', schema: { type: 'string' }, description: 'Lọc: ILIKE %value%' },
                ],
                responses: {
                    '200': {
                        description: 'Mảng records',
                        headers: { 'X-Total-Count': { schema: { type: 'integer' }, description: 'Tổng số records' } },
                        content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } },
                    },
                    '404': { description: 'Bảng không tồn tại' },
                },
            },
            post: {
                tags: ['Dynamic CRUD'],
                summary: 'Tạo mới một record (cần token)',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'resource', in: 'path', required: true, schema: { type: 'string' }, example: 'posts' },
                ],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', example: { title: 'Hello', content: 'World' } } } },
                },
                responses: {
                    '201': { description: 'Record mới được tạo' },
                    '400': { description: 'Validation lỗi' },
                    '401': { description: 'Thiếu hoặc sai token' },
                    '404': { description: 'Bảng không tồn tại' },
                },
            },
        },
        '/{resource}/{id}': {
            get: {
                tags: ['Dynamic CRUD'],
                summary: 'Lấy một record theo ID',
                parameters: [
                    { name: 'resource', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
                ],
                responses: {
                    '200': { description: 'Record tìm thấy' },
                    '400': { description: 'ID không hợp lệ' },
                    '404': { description: 'Không tìm thấy record' },
                },
            },
            put: {
                tags: ['Dynamic CRUD'],
                summary: 'Thay thế toàn bộ record (cần token)',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'resource', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
                ],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object' } } },
                },
                responses: {
                    '200': { description: 'Record sau khi thay thế' },
                    '401': { description: 'Thiếu hoặc sai token' },
                    '404': { description: 'Record không tồn tại' },
                },
            },
            patch: {
                tags: ['Dynamic CRUD'],
                summary: 'Cập nhật một phần record (cần token)',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'resource', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
                ],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object' } } },
                },
                responses: {
                    '200': { description: 'Record sau khi cập nhật' },
                    '401': { description: 'Thiếu hoặc sai token' },
                    '404': { description: 'Record không tồn tại' },
                },
            },
            delete: {
                tags: ['Dynamic CRUD'],
                summary: 'Xoá record (chỉ admin)',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'resource', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
                ],
                responses: {
                    '200': { description: 'Xoá thành công' },
                    '401': { description: 'Thiếu hoặc sai token' },
                    '403': { description: 'Không phải admin' },
                    '404': { description: 'Record không tồn tại' },
                },
            },
        },
    },
};
