// src/app/module/category/category.route.ts
import { Router } from "express";
import { Role } from "@prisma/client";
import { checkAuth } from "../../middleware/checkAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { CategoryController } from "./category.controller.js";
import { createCategoryZodSchema, updateCategoryZodSchema } from "./category.validation.js";

const router = Router();

// Public routes
router.get("/", CategoryController.getAllCategories);
router.get("/slug/:slug", CategoryController.getCategoryBySlug);
router.get("/:id", CategoryController.getCategoryById);

// Admin only routes
router.post(
  "/", 
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN), 
  validateRequest(createCategoryZodSchema),
  CategoryController.createCategory
);

router.patch(
  "/:id", 
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN), 
  validateRequest(updateCategoryZodSchema),
  CategoryController.updateCategory
);

router.delete(
  "/:id", 
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN), 
  CategoryController.deleteCategory
);

export const CategoryRoutes = router;
