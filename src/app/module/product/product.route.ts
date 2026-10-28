import { Router } from "express";
import { Role } from "@prisma/client";
import { multerUpload } from "../../config/multer.config.js";
import { checkAuth } from "../../middleware/checkAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { ProductController } from "./product.controller.js";
import { productSchema, productUpdateSchema } from "./product.validation.js";

const router = Router();

router.get("/", ProductController.list);
router.get("/store-settings", ProductController.getStoreSettings);
router.post("/upload-images", multerUpload.any(), ProductController.uploadImages);
router.get("/:id", ProductController.get);
router.post("/", checkAuth(Role.ADMIN), validateRequest(productSchema), ProductController.create);
router.post("/:id/duplicate", checkAuth(Role.ADMIN), ProductController.duplicate);
router.patch("/:id", checkAuth(Role.ADMIN), validateRequest(productUpdateSchema), ProductController.update);
router.put("/:id", checkAuth(Role.ADMIN), validateRequest(productUpdateSchema), ProductController.update);
router.delete("/:id", checkAuth(Role.ADMIN), ProductController.remove);

export { router as ProductRoutes };