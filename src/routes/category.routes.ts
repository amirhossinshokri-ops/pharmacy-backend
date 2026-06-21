import { Router } from 'express';
import * as categoryService from '../services/category.service';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { upload } from '../config/multer';
import { sendSuccess, sendCreated } from '../utils/response';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const cats = await categoryService.getCategories();
    return sendSuccess(res, cats);
  } catch (err) { return next(err); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const cat = await categoryService.getCategoryBySlug(req.params.slug);
    return sendSuccess(res, cat);
  } catch (err) { return next(err); }
});

router.post('/', authenticate, authorize('ADMIN'), upload.single('image'), async (req, res, next) => {
  try {
    const cat = await categoryService.createCategory(req.body, req.file?.path);
    return sendCreated(res, cat, 'دسته‌بندی با موفقیت ایجاد شد');
  } catch (err) { return next(err); }
});

router.patch('/:id', authenticate, authorize('ADMIN'), upload.single('image'), async (req, res, next) => {
  try {
    const cat = await categoryService.updateCategory(parseInt(req.params.id), req.body, req.file?.path);
    return sendSuccess(res, cat, 'دسته‌بندی با موفقیت بروزرسانی شد');
  } catch (err) { return next(err); }
});

router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    await categoryService.deleteCategory(parseInt(req.params.id));
    return sendSuccess(res, null, 'دسته‌بندی با موفقیت حذف شد');
  } catch (err) { return next(err); }
});

export default router;
