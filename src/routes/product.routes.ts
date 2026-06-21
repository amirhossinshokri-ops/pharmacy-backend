import { Router } from 'express';
import * as productController from '../controllers/product.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { upload } from '../config/multer';
import { productQuerySchema } from '../validators/schemas';

const router = Router();

router.get('/', validate(productQuerySchema, 'query'), productController.getProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/bestsellers', productController.getBestSellers);
router.get('/slug/:slug', productController.getProductBySlug);
router.get('/:id', productController.getProductById);
router.get('/:id/related', productController.getRelatedProducts);

// Admin only
router.post('/', authenticate, authorize('ADMIN'), upload.array('images', 5), productController.createProduct);
router.patch('/:id', authenticate, authorize('ADMIN'), upload.array('images', 5), productController.updateProduct);
router.delete('/:id', authenticate, authorize('ADMIN'), productController.deleteProduct);

export default router;
