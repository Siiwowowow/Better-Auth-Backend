//src>app>module>admin>admin.controller.ts
import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { AdminService } from "./admin.service.js";
import { IRequestUser } from "../../interfaces/requestUser.interface.js";
import { IChangeUserRolePayload, IChangeUserStatusPayload } from "./admin.interface.js";

const getAllAdmins = catchAsync(
    async (req: Request, res: Response) => {
        const result = await AdminService.getAllAdmins();

        sendResponse(res, {
            httpCode: status.OK,
            success: true,
            message: "Admins fetched successfully",
            data: result,
        })
    }
)

const getAdminById = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        const admin = await AdminService.getAdminById(id as string);

        sendResponse(res, {
            httpCode: status.OK,
            success: true,
            message: "Admin fetched successfully",
            data: admin,
        })
    }
)

const updateAdmin = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const payload = req.body;

        const updatedAdmin = await AdminService.updateAdmin(id as string, payload);

        sendResponse(res, {
            httpCode: status.OK,
            success: true,
            message: "Admin updated successfully",
            data: updatedAdmin,
        })
    }
)

const deleteAdmin = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const user = req.user as IRequestUser;

        const result = await AdminService.deleteAdmin(id as string, user);

        sendResponse(res, {
            httpCode: status.OK,
            success: true,
            message: "Admin deleted successfully",
            data: result,
        })
    }
)

const changeUserStatus = catchAsync(
    async (req: Request, res: Response) => {
        const payload: IChangeUserStatusPayload = req.body;
        const currentUser = req.user as IRequestUser;
        
        const result = await AdminService.changeUserStatus(payload, currentUser);
        
        sendResponse(res, {
            httpCode: status.OK,
            success: true,
            message: "User status updated successfully",
            data: result,
        })
    }
);

const changeUserRole = catchAsync(
    async (req: Request, res: Response) => {
        const payload: IChangeUserRolePayload = req.body;
        const currentUser = req.user as IRequestUser;
        
        const result = await AdminService.changeUserRole(payload, currentUser);
        
        sendResponse(res, {
            httpCode: status.OK,
            success: true,
            message: "User role updated successfully",
            data: result,
        })
    }
);

export const AdminController = {
    getAllAdmins,
    updateAdmin,
    deleteAdmin,
    getAdminById,
    changeUserStatus,
    changeUserRole
};