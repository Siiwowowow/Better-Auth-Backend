import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { CartService } from "./cart.service.js";
export const CartController = {
  get: catchAsync(async (req: Request, res: Response) => sendResponse(res, { httpCode: status.OK, success: true, message: "Cart fetched successfully", data: await CartService.get(req.user!.userId) })),
  upsert: catchAsync(async (req: Request, res: Response) => { await CartService.upsert(req.user!.userId, req.body.productId, req.body.quantity); sendResponse(res, { httpCode: status.OK, success: true, message: "Cart updated successfully", data: await CartService.get(req.user!.userId) }); }),
  remove: catchAsync(async (req: Request, res: Response) => { await CartService.remove(req.user!.userId, req.params.productId as string); sendResponse(res, { httpCode: status.OK, success: true, message: "Item removed from cart", data: await CartService.get(req.user!.userId) }); }),
  clear: catchAsync(async (req: Request, res: Response) => { await CartService.clear(req.user!.userId); sendResponse(res, { httpCode: status.OK, success: true, message: "Cart cleared", data: null }); }),
};
