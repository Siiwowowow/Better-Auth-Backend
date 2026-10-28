import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { AddressService } from "./address.service.js";
export const AddressController = {
 list: catchAsync(async (req: Request, res: Response) => sendResponse(res, { httpCode: status.OK, success: true, message: "Addresses fetched successfully", data: await AddressService.list(req.user!.userId) })),
 create: catchAsync(async (req: Request, res: Response) => sendResponse(res, { httpCode: status.CREATED, success: true, message: "Address created successfully", data: await AddressService.create(req.user!.userId, req.body) })),
 update: catchAsync(async (req: Request, res: Response) => sendResponse(res, { httpCode: status.OK, success: true, message: "Address updated successfully", data: await AddressService.update(req.user!.userId, req.params.id as string, req.body) })),
 remove: catchAsync(async (req: Request, res: Response) => { await AddressService.remove(req.user!.userId, req.params.id as string); sendResponse(res, { httpCode: status.OK, success: true, message: "Address deleted successfully", data: null }); }),
};
