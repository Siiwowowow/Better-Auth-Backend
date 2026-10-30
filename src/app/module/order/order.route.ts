import { Router } from "express";
import { Role } from "@prisma/client";
import { checkAuth, optionalAuth } from "../../middleware/checkAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { OrderController } from "./order.controller.js";
import {
  bulkOrderStatusSchema,
  cancelOrderSchema,
  createAdminOrderSchema,
  createOrderSchema,
  orderStatusSchema,
} from "./order.validation.js";

const router = Router();

// Public / Guest & Authenticated Order Placement
router.post("/", optionalAuth, validateRequest(createOrderSchema), OrderController.create);

// Public Order Tracking
router.get("/track/:orderNumber", OrderController.track);

// User or Guest Order Cancellation
router.patch("/:id/cancel", optionalAuth, validateRequest(cancelOrderSchema), OrderController.cancel);

// User Order Delete (soft delete for user view)
router.patch("/:id/user-delete", optionalAuth, OrderController.userDelete);

// Order List (User list or Admin list)
router.get("/", optionalAuth, OrderController.list);

// Order Details
router.get("/:id", optionalAuth, OrderController.get);

// Admin-specific routes
router.post("/admin", optionalAuth, validateRequest(createAdminOrderSchema), OrderController.createAdmin);
router.patch("/bulk-status", optionalAuth, validateRequest(bulkOrderStatusSchema), OrderController.bulkUpdate);
router.post("/bulk-delete", optionalAuth, OrderController.bulkRemove);
router.patch("/:id/status", optionalAuth, validateRequest(orderStatusSchema), OrderController.update);
router.patch("/:id", optionalAuth, validateRequest(orderStatusSchema), OrderController.update);
router.delete("/:id", optionalAuth, OrderController.remove);

// Payment
router.post("/:id/pay", checkAuth(Role.USER, Role.ADMIN), OrderController.pay);

export { router as OrderRoutes };
