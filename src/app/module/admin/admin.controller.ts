// src/app/module/admin/admin.controller.ts
import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { AdminService } from "./admin.service.js";
import { AdminDashboardService } from "./admin.dashboard.service.js";
import { AdminResourcesService } from "./admin.resources.service.js";
import { IRequestUser } from "../../interfaces/requestUser.interface.js";
import { IChangeUserRolePayload, IChangeUserStatusPayload } from "./admin.interface.js";

const getAllAdmins = catchAsync(async (_req: Request, res: Response) => {
  const result = await AdminService.getAllAdmins();
  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "Admins fetched successfully",
    data: result,
  });
});

const getAdminById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const admin = await AdminService.getAdminById(id as string);
  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "Admin fetched successfully",
    data: admin,
  });
});

const createAdmin = catchAsync(async (req: Request, res: Response) => {
  const currentUser = req.user as IRequestUser;
  const created = await AdminService.createAdmin(req.body, currentUser);
  sendResponse(res, {
    httpCode: status.CREATED,
    success: true,
    message: "Admin created successfully",
    data: created,
  });
});

const updateAdmin = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const payload = req.body;
  const currentUser = req.user as IRequestUser;
  const updatedAdmin = await AdminService.updateAdmin(id as string, payload, currentUser);
  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "Admin updated successfully",
    data: updatedAdmin,
  });
});

const deleteAdmin = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user as IRequestUser;
  const result = await AdminService.deleteAdmin(id as string, user);
  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "Admin deleted successfully",
    data: result,
  });
});

const changeUserStatus = catchAsync(async (req: Request, res: Response) => {
  const payload: IChangeUserStatusPayload = req.body;
  const currentUser = req.user as IRequestUser;
  const result = await AdminService.changeUserStatus(payload, currentUser);
  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "User status updated successfully",
    data: result,
  });
});

const changeUserRole = catchAsync(async (req: Request, res: Response) => {
  const payload: IChangeUserRolePayload = req.body;
  const currentUser = req.user as IRequestUser;
  const result = await AdminService.changeUserRole(payload, currentUser);
  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "User role updated successfully",
    data: result,
  });
});

const getDashboardOverview = catchAsync(async (_req: Request, res: Response) => {
  const result = await AdminDashboardService.getOverview();
  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "Dashboard overview fetched successfully",
    data: result,
  });
});

const getResource = catchAsync(async (req: Request, res: Response) => {
  const { resource } = req.params;
  const result = await AdminResourcesService.getResource(resource as string);
  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "Resource data fetched successfully",
    data: result,
  });
});

const createResourceItem = catchAsync(async (req: Request, res: Response) => {
  const { resource } = req.params;
  const currentUser = req.user as IRequestUser;
  const result = await AdminResourcesService.createResourceItem(
    resource as string,
    req.body,
    currentUser?.userId
  );
  sendResponse(res, {
    httpCode: status.CREATED,
    success: true,
    message: "Record created successfully",
    data: result,
  });
});

const updateResourceItem = catchAsync(async (req: Request, res: Response) => {
  const { resource, id } = req.params;
  const result = await AdminResourcesService.updateResourceItem(
    resource as string,
    id as string,
    req.body
  );
  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "Record updated successfully",
    data: result,
  });
});

const toggleResourceStatus = catchAsync(async (req: Request, res: Response) => {
  const { resource, id } = req.params;
  const result = await AdminResourcesService.toggleResourceStatus(
    resource as string,
    id as string
  );
  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "Status updated successfully",
    data: result,
  });
});

const deleteResourceItem = catchAsync(async (req: Request, res: Response) => {
  const { resource, id } = req.params;
  const currentUser = req.user as IRequestUser;
  const result = await AdminResourcesService.deleteResourceItem(
    resource as string,
    id as string,
    currentUser?.userId
  );
  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "Record deleted successfully",
    data: result,
  });
});

const bulkDeleteResourceItems = catchAsync(async (req: Request, res: Response) => {
  const { resource } = req.params;
  const currentUser = req.user as IRequestUser;
  const result = await AdminResourcesService.bulkDeleteResourceItems(
    resource as string,
    req.body.ids || [],
    currentUser?.userId
  );
  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "Records deleted successfully",
    data: result,
  });
});

const getNotifications = catchAsync(async (req: Request, res: Response) => {
  const currentUser = req.user as IRequestUser;
  const result = await AdminResourcesService.getNotifications(currentUser.userId);
  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "Notifications fetched successfully",
    data: result,
  });
});

const markNotificationsRead = catchAsync(async (req: Request, res: Response) => {
  const currentUser = req.user as IRequestUser;
  const result = await AdminResourcesService.markNotificationsRead(currentUser.userId);
  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "Notifications marked as read",
    data: result,
  });
});

const globalSearch = catchAsync(async (req: Request, res: Response) => {
  const q = String(req.query.q || "");
  const result = await AdminResourcesService.globalSearch(q);
  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "Search results fetched",
    data: result,
  });
});

export const AdminController = {
  getAllAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  changeUserStatus,
  changeUserRole,
  getDashboardOverview,
  getResource,
  createResourceItem,
  updateResourceItem,
  toggleResourceStatus,
  deleteResourceItem,
  bulkDeleteResourceItems,
  getNotifications,
  markNotificationsRead,
  globalSearch,
};
