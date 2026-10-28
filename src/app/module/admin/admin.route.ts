// src/app/module/admin/admin.route.ts
import { Router } from "express";
import { Role } from "@prisma/client";
import { checkAuth } from "../../middleware/checkAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { AdminController } from "./admin.controller.js";
import { createAdminZodSchema, updateAdminZodSchema } from "./admin.validation.js";

const router = Router();

router.use(checkAuth(Role.ADMIN));

// Static & sub-resource routes first (before /:id)
router.get("/dashboard", AdminController.getDashboardOverview);
router.get("/notifications", AdminController.getNotifications);
router.post("/notifications/read", AdminController.markNotificationsRead);
router.get("/search", AdminController.globalSearch);

router.get("/resources/:resource", AdminController.getResource);
router.post("/resources/:resource", AdminController.createResourceItem);
router.post("/resources/:resource/bulk-delete", AdminController.bulkDeleteResourceItems);
router.patch("/resources/:resource/:id/status", AdminController.toggleResourceStatus);
router.patch("/resources/:resource/:id", AdminController.updateResourceItem);
router.put("/resources/:resource/:id", AdminController.updateResourceItem);
router.delete("/resources/:resource/:id", AdminController.deleteResourceItem);

router.patch("/change-user-status", AdminController.changeUserStatus);
router.patch("/change-user-role", AdminController.changeUserRole);

// Base Admin CRUD routes
router.get("/", AdminController.getAllAdmins);
router.post("/", validateRequest(createAdminZodSchema), AdminController.createAdmin);
router.get("/:id", AdminController.getAdminById);
router.patch("/:id", validateRequest(updateAdminZodSchema), AdminController.updateAdmin);
router.put("/:id", validateRequest(updateAdminZodSchema), AdminController.updateAdmin);
router.delete("/:id", AdminController.deleteAdmin);

export const AdminRoutes = router;
