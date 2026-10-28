import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { OrderService } from "./order.service.js";
import { PaymentService } from "../payment/payment.service.js";

export const OrderController = {
  create: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.CREATED,
      success: true,
      message: "Order placed successfully",
      data: await OrderService.create(req.user!.userId, req.body),
    })
  ),
  createAdmin: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.CREATED,
      success: true,
      message: "Order created successfully",
      data: await OrderService.createAdminOrder(req.user!.userId, req.body),
    })
  ),
  list: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: "Orders fetched successfully",
      data: await OrderService.list(req.user!.userId, req.user!.role === "ADMIN"),
    })
  ),
  get: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: "Order fetched successfully",
      data: await OrderService.get(
        req.params.id as string,
        req.user!.userId,
        req.user!.role === "ADMIN"
      ),
    })
  ),
  update: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: "Order updated successfully",
      data: await OrderService.updateStatus(req.params.id as string, req.body, req.user?.userId),
    })
  ),
  bulkUpdate: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: "Orders updated successfully",
      data: await OrderService.bulkUpdateStatus(req.body.ids, req.body, req.user?.userId),
    })
  ),
  remove: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: "Order deleted successfully",
      data: await OrderService.remove(req.params.id as string),
    })
  ),
  bulkRemove: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: "Orders deleted successfully",
      data: await OrderService.bulkRemove(req.body.ids || []),
    })
  ),
  pay: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: "Demo payment completed",
      data: await PaymentService.payDemo(req.params.id as string, req.user!.userId),
    })
  ),
};
