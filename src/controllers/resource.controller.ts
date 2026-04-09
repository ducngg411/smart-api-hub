import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { db } from "../db/knex";
import { tableExists } from "../utils/tableValidator";
import { logAudit } from "../utils/auditLog";

type ResourceParams = {resource: string};
type ResourceIdParams = {resource: string, id: string};

// Get All
export async function getAll(req: Request<ResourceParams>, res: Response) {
    const { resource } = req.params;

    if (!(await tableExists(resource))) {
        return res.status(404).json({ error: `Bảng ${resource} không tồn tại`});
    };

    const columnInfo = await db(resource).columnInfo();

    const page = Math.max(1, parseInt(req.query._page as string) || 1); 
    const limit = Math.min(100, parseInt(req.query._limit as string) || 10);
    const offset = (page - 1) * limit;
    const sortByRaw = (req.query._sort as string) || 'id';
    if (!columnInfo[sortByRaw]) {
        return res.status(400).json({ error: `Cột sort không hợp lệ: ${sortByRaw}` });
    }
    const sortBy = sortByRaw;
    const order = (req.query._order as string)?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    const [{count}] = await db(resource).count('id as count');
    const total = Number(count);

    // Filtering: ?_gte, ?_lte, ?_ne, ?_like
    let query = db(resource).orderBy(sortBy, order).limit(limit).offset(offset);

    for (const [key, value] of Object.entries(req.query)) {
        if (['_page', '_limit', '_sort', '_order', '_orderBy', '_fields', 'q', '_expand', '_embed'].includes(key)) continue;

        if (key.endsWith('_gte')) {
            query = query.where(key.replace('_gte', ''), '>=', value as string);
        } else if (key.endsWith('_lte')) {
            query = query.where(key.replace('_lte', ''), '<=', value as string);
        } else if (key.endsWith('_ne')) {
            query = query.whereNot(key.replace('_ne', ''), value as string);
        } else if (key.endsWith('_like')) {
            query = query.whereILike(key.replace('_like', ''), `%${value}%`);
        } else {
            query = query.where(key, value as string);
        }
    }

    const searchQuery = req.query.q as string | undefined;

    if (searchQuery) {
        const textColumns = Object.entries(columnInfo)
            .filter(([, info]) => info.type === 'text')
            .map(([col]) => col);

        query = query.where((builder) => {
            for (const col of textColumns) {
                builder.orWhereILike(col, `%${searchQuery}%`);
            }
        });
    }

    const fields = req.query._fields
        ? (req.query._fields as string).split(',')
        : ['*'];

    query = query.select(fields);

    // _expand: lấy dữ liệu bảng cha
    const expandResource = req.query._expand as string | undefined;

    if (expandResource) {
        const singular = expandResource.replace(/s$/, '');
        const foreignKey = `${singular}_id`;
        const fallbackKey = `${expandResource}_id`;

        if (!(await tableExists(expandResource))) {
            return res.status(400).json({ error: `Resource '${expandResource}' không tồn tại` });
        }

        const actualKey = columnInfo[foreignKey]
            ? foreignKey
            : columnInfo[fallbackKey]
            ? fallbackKey
            : null;

        if (!actualKey) {
            return res.status(400).json({
                error: `Không tìm thấy foreign key '${foreignKey}' trong bảng '${resource}'`,
            });
        }

        // resource, actualKey, expandResource đều đã được validate qua tableExists + columnInfo
        const dataWithParent = await db(resource)
            .select(`${resource}.*`)
            .joinRaw(
                `inner join "${expandResource}" on "${resource}"."${actualKey}"::integer = "${expandResource}".id`
            )
            .orderBy(`${resource}.${sortBy}`, order)
            .limit(limit)
            .offset(offset);

        res.setHeader('X-Total-Count', total);
        return res.status(200).json(dataWithParent);
    }

    // _embed: lấy dữ liệu bảng con
    const embedResource = req.query._embed as string | undefined;

    if (embedResource) {
        const foreignKey = `${resource.replace(/s$/, '')}_id`;

        if (!(await tableExists(embedResource))) {
            return res.status(400).json({ error: `Resource '${embedResource}' không tồn tại` });
        }

        const parents = await query;

        const result = await Promise.all(
            parents.map(async (parent: Record<string, unknown>) => {
                const children = await db(embedResource).where({ [foreignKey]: parent.id });
                return { ...parent, [embedResource]: children };
            })
        );

        res.setHeader('X-Total-Count', total);
        return res.status(200).json(result);
    }

    const data = await query;
    res.setHeader('X-Total-Count', total);
    res.status(200).json(data);
};

// Get By ID
export async function getById(req: Request<ResourceIdParams>, res: Response) {
    const { resource, id} = req.params;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ error: 'ID phải là số nguyên hợp lệ' });
    };

    if (!(await tableExists(resource))) {
        return res.status(404).json({ error: `Bảng ${resource} không tồn tại`});
    };
    
    const item = await db(resource).where({ id: Number(id)}).first();

    if (!item) {
        return res.status(404).json({ error: `${resource} id = ${id} không tồn tại` });
    }

    return res.status(200).json(item);
};

// POST
export async function createOne(
    req: AuthRequest & { params: ResourceParams },
    res: Response
) {
    const { resource } = req.params;

    if (!(await tableExists(resource))) {
        return res.status(404).json({ error: `Bảng ${resource} không tồn tại` });
    }

    const columnInfo = await db(resource).columnInfo();
    const payload: Record<string, unknown> = { ...req.body };

    if (Object.prototype.hasOwnProperty.call(payload, "id")) {
        delete payload.id;
    }

    if ("user_id" in columnInfo && req.user?.id != null) {
        payload.user_id = Number(req.user.id);
    }

    const [newItem] = await db(resource).insert(payload).returning("*");

    logAudit(req.user?.id, 'CREATE', resource, newItem.id);
    return res.status(201).json(newItem);
}

// PUT 

export async function replaceOne(req: AuthRequest & { params: ResourceIdParams }, res: Response) {
    const { resource, id } = req.params;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ error: 'ID phải là số nguyên hợp lệ' });
    }

    if (!(await tableExists(resource))) {
        return res.status(404).json({ error: `Bảng ${resource} không tồn tại` });
    }

    const columns = await db(resource).columnInfo();
    const nullified: Record<string, null> = {};

    for (const col of Object.keys(columns)) {
        if (!['id', 'created_at'].includes(col)) {
            nullified[col] = null;
        }
    }

    const payload = { ...nullified, ...req.body, updated_at: new Date() };
    const [updated] = await db(resource)
        .where({ id: Number(id) })
        .update(payload)
        .returning('*');

    if (!updated) {
        return res.status(404).json({ error: `${resource} id=${id} không tồn tại` });
    }

    logAudit(req.user?.id, 'UPDATE', resource, updated.id);
    return res.status(200).json(updated);
}

// PATCH
export async function updateOne(req: AuthRequest & { params: ResourceIdParams }, res: Response) {
    const { resource, id } = req.params;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ error: 'ID phải là số nguyên hợp lệ' });
    }

    if (!(await tableExists(resource))) {
        return res.status(404).json({ error: `Bảng ${resource} không tồn tại` });
    }

    const [updated] = await db(resource)
        .where({ id: Number(id)})
        .update({...req.body, updated_at: new Date()})
        .returning('*');

    if (!updated) {
        return res.status(400).json({ error: `${resource} id=${id} không tồn tại` });
    }

    logAudit(req.user?.id, 'UPDATE', resource, updated.id);
    res.status(200).json(updated);
}

export async function deleteOne(req: AuthRequest & { params: ResourceIdParams }, res: Response) {
    const { resource, id } = req.params;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ error: 'ID phải là số nguyên hợp lệ' });
    };

    if (!(await tableExists(resource))) {
        return res.status(404).json({ error: `Bảng ${resource} không tồn tại` });
    }

    const deleted = await db(resource).where({ id: Number(id) }).delete();

    if (!deleted) {
        return res.status(404).json({ error: `${resource} id=${id} không tồn tại` });
    }

    logAudit(req.user?.id, 'DELETE', resource, Number(id));
    res.status(200).json(deleted);
};