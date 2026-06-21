import { Request, Response, NextFunction } from 'express';
import * as productService from '../services/product.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { processProductImage } from '../services/image.service';
import type { ProductQueryInput } from '../validators/schemas';

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await productService.getProducts(req.query as unknown as ProductQueryInput);
    return sendSuccess(res, result.products, 'محصولات با موفقیت دریافت شدند', 200, result.meta);
  } catch (err) {
    return next(err);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await productService.getProductById(parseInt(req.params.id));
    return sendSuccess(res, product);
  } catch (err) {
    return next(err);
  }
};

export const getProductBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await productService.getProductBySlug(req.params.slug);
    return sendSuccess(res, product);
  } catch (err) {
    return next(err);
  }
};

export const getFeaturedProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 8;
    const products = await productService.getFeaturedProducts(limit);
    return sendSuccess(res, products, 'محصولات ویژه با موفقیت دریافت شدند');
  } catch (err) {
    return next(err);
  }
};

export const getBestSellers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 8;
    const products = await productService.getBestSellers(limit);
    return sendSuccess(res, products, 'پرفروش‌ترین محصولات با موفقیت دریافت شدند');
  } catch (err) {
    return next(err);
  }
};

export const getRelatedProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await productService.getRelatedProducts(parseInt(req.params.id));
    return sendSuccess(res, products);
  } catch (err) {
    return next(err);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    const images: string[] = [];
    if (files?.length) {
      for (const file of files) {
        const url = await processProductImage(file.path);
        images.push(url);
      }
    }

    const data = {
      ...req.body,
      price: parseInt(req.body.price),
      originalPrice: req.body.originalPrice ? parseInt(req.body.originalPrice) : undefined,
      stock: parseInt(req.body.stock ?? '0'),
      categoryId: parseInt(req.body.categoryId),
      tags: req.body.tags ? JSON.parse(req.body.tags) : [],
      isFeatured: req.body.isFeatured === 'true',
    };

    const product = await productService.createProduct(data, images);
    return sendCreated(res, product, 'محصول با موفقیت ایجاد شد');
  } catch (err) {
    return next(err);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    const newImages: string[] = [];
    if (files?.length) {
      for (const file of files) {
        const url = await processProductImage(file.path);
        newImages.push(url);
      }
    }

    const data = {
      ...req.body,
      ...(req.body.price && { price: parseInt(req.body.price) }),
      ...(req.body.originalPrice && { originalPrice: parseInt(req.body.originalPrice) }),
      ...(req.body.stock !== undefined && { stock: parseInt(req.body.stock) }),
      ...(req.body.categoryId && { categoryId: parseInt(req.body.categoryId) }),
      ...(req.body.tags && { tags: JSON.parse(req.body.tags) }),
      ...(req.body.isFeatured !== undefined && { isFeatured: req.body.isFeatured === 'true' }),
    };

    const product = await productService.updateProduct(
      parseInt(req.params.id),
      data,
      newImages
    );
    return sendSuccess(res, product, 'محصول با موفقیت بروزرسانی شد');
  } catch (err) {
    return next(err);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await productService.deleteProduct(parseInt(req.params.id));
    return sendSuccess(res, null, 'محصول با موفقیت حذف شد');
  } catch (err) {
    return next(err);
  }
};
