import { Request, Response, NextFunction } from 'express';
import * as categoryService from '../services/category.service';
import { sendSuccess, sendCreated } from '../utils/response';

export const getCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await categoryService.getCategories();
    return sendSuccess(res, categories, 'دسته‌بندی‌ها دریافت شدند');
  } catch (err) { return next(err); }
};

export const getCategoryById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await categoryService.getCategoryById(parseInt(req.params.id));
    return sendSuccess(res, category);
  } catch (err) { return next(err); }
};

export const getCategoryBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await categoryService.getCategoryBySlug(req.params.slug);
    return sendSuccess(res, category);
  } catch (err) { return next(err); }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const image = req.file ? `/uploads/categories/${req.file.filename}` : undefined;
    const data = {
      ...req.body,
      parentId: req.body.parentId ? parseInt(req.body.parentId) : undefined,
      sortOrder: req.body.sortOrder ? parseInt(req.body.sortOrder) : 0,
      isActive: req.body.isActive !== 'false',
    };
    const category = await categoryService.createCategory(data, image);
    return sendCreated(res, category, 'دسته‌بندی ایجاد شد');
  } catch (err) { return next(err); }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const image = req.file ? `/uploads/categories/${req.file.filename}` : undefined;
    const category = await categoryService.updateCategory(parseInt(req.params.id), req.body, image);
    return sendSuccess(res, category, 'دسته‌بندی بروزرسانی شد');
  } catch (err) { return next(err); }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await categoryService.deleteCategory(parseInt(req.params.id));
    return sendSuccess(res, null, 'دسته‌بندی حذف شد');
  } catch (err) { return next(err); }
};
