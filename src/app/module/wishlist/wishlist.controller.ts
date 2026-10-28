import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { WishlistService } from "./wishlist.service.js";
export const WishlistController = { list: catchAsync(async (req: Request, res: Response) => sendResponse(res, { httpCode: status.OK, success: true, message: "Wishlist fetched successfully", data: await WishlistService.list(req.user!.userId) })), add: catchAsync(async (req: Request, res: Response) => sendResponse(res, { httpCode: status.CREATED, success: true, message: "Added to wishlist", data: await WishlistService.add(req.user!.userId, req.params.productId as string) })), remove: catchAsync(async (req: Request, res: Response) => { await WishlistService.remove(req.user!.userId, req.params.productId as string); sendResponse(res, { httpCode: status.OK, success: true, message: "Removed from wishlist", data: null }); }) };
