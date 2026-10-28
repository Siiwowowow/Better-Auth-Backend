import { Router } from "express";
import { Role } from "@prisma/client";
import { checkAuth } from "../../middleware/checkAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { OrderController } from "./order.controller.js";
import {
  bulkOrderStatusSchema,
  createAdminOrderSchema,
  createOrderSchema,
  orderStatusSchema,
} from "./order.validation.js";

const router = Router();
router.use(checkAuth(Role.USER, Role.ADMIN));

router.post("/", validateRequest(createOrderSchema), OrderController.create);
router.post("/admin", checkAuth(Role.ADMIN), validateRequest(createAdminOrderSchema), OrderController.createAdmin);
router.patch("/bulk-status", checkAuth(Role.ADMIN), validateRequest(bulkOrderStatusSchema), OrderController.bulkUpdate);
router.post("/bulk-delete", checkAuth(Role.ADMIN), OrderController.bulkRemove);
router.get("/", OrderController.list);
router.get("/:id", OrderController.get);
router.post("/:id/pay", OrderController.pay);
router.patch("/:id/status", checkAuth(Role.ADMIN), validateRequest(orderStatusSchema), OrderController.update);
router.patch("/:id", checkAuth(Role.ADMIN), validateRequest(orderStatusSchema), OrderController.update);
router.delete("/:id", checkAuth(Role.ADMIN), OrderController.remove);

export { router as OrderRoutes };
