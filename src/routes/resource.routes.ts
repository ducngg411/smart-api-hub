import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';
import { validateResourceBody } from '../middlewares/validate.middleware';

import {
    getAll,
    getById,
    createOne,
    replaceOne,
    updateOne,
    deleteOne,
} from '../controllers/resource.controller';

const router = Router();

router.get('/:resource', getAll);
router.get('/:resource/:id', getById);

router.post('/:resource', authenticate, validateResourceBody('post'), createOne);
router.put('/:resource/:id', authenticate, validateResourceBody('put'), replaceOne);
router.patch('/:resource/:id', authenticate, validateResourceBody('patch'), updateOne);

router.delete('/:resource/:id', authenticate, requireAdmin, deleteOne);

export default router;