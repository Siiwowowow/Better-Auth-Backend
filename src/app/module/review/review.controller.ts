import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { ReviewService } from "./review.service.js";

export const ReviewController = {
  list: catchAsync(async (_req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: "Reviews fetched successfully",
      data: await ReviewService.list(),
    })
  ),
  upsert: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: "Review saved successfully",
      data: await ReviewService.upsert(req.user!.userId, req.body),
    })
  ),
  update: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: "Review updated successfully",
      data: await ReviewService.update(req.params.id as string, req.body),
    })
  ),
  remove: catchAsync(async (req: Request, res: Response) => {
    await ReviewService.remove(
      req.user!.userId,
      req.params.id as string,
      req.user!.role === "ADMIN"
    );
    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: "Review deleted successfully",
      data: null,
    });
  }),
};
