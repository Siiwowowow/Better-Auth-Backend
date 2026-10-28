/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { uploadFileToCloudinary } from "../../config/cloudinary.config.js";
import { prisma } from "../../lib/prisma.js";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { ProductService } from "./product.service.js";

export const ProductController = {
  list: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: "Products fetched successfully",
      data: await ProductService.list(req.query, req.query.includeAll === "true"),
    })
  ),
  getStoreSettings: catchAsync(async (_req: Request, res: Response) => {
    const [shippingZones, taxRules, settingLogs, bannerLogs] = await Promise.all([
      prisma.shippingZone.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } }),
      prisma.taxRule.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } }),
      prisma.auditLog.findMany({ where: { entity: "ADMIN_SETTING" }, orderBy: { createdAt: "desc" } }),
      prisma.auditLog.findMany({ where: { entity: "ADMIN_BANNER" }, orderBy: { createdAt: "desc" } }),
    ]);

    const settings = settingLogs
      .map((log) => {
        const meta = (log.metadata as Record<string, any>) || {};
        return {
          id: log.id,
          name: String(meta.name || ""),
          description: String(meta.description || ""),
          value: String(meta.value || ""),
          owner: String(meta.owner || "Admin"),
          status: String(meta.status || "Configured"),
        };
      })
      .filter((s) => s.status.toLowerCase() !== "inactive");

    const findSetting = (pattern: RegExp) =>
      settings.find((s) => pattern.test(s.name) || pattern.test(s.description));

    const hotlineSetting = findSetting(/hotline|helpline|phone|contact/i);
    const deliverySetting = findSetting(/delivery|shipping|courier/i);
    const wholesaleSetting = findSetting(/wholesale|paikari|bulk/i);

    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: "Store settings fetched successfully",
      data: {
        hotline: hotlineSetting?.value || hotlineSetting?.description || "+880 1234-567890",
        deliveryAnnouncement:
          deliverySetting?.description || "Fast Delivery across Bangladesh",
        wholesaleAnnouncement:
          wholesaleSetting?.description ||
          "Special bulk rates for retailers & electricians.",
        shippingZones: shippingZones.map((z) => ({
          id: z.id,
          name: z.name,
          cities: z.cities,
          deliveryFee: Number(z.deliveryFee),
        })),
        taxRules: taxRules.map((t) => ({
          id: t.id,
          name: t.name,
          code: t.code,
          rate: Number(t.rate),
        })),
        settings,
        banners: bannerLogs
          .map((b) => (b.metadata as Record<string, any>) || {})
          .filter((b) => String(b.status || "Active").toLowerCase() === "active"),
      },
    });
  }),
  get: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: "Product fetched successfully",
      data: await ProductService.get(req.params.id as string),
    })
  ),
  create: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.CREATED,
      success: true,
      message: "Product created successfully",
      data: await ProductService.create(req.body),
    })
  ),
  update: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: "Product updated successfully",
      data: await ProductService.update(req.params.id as string, req.body),
    })
  ),
  duplicate: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.CREATED,
      success: true,
      message: "Product duplicated successfully",
      data: await ProductService.duplicate(req.params.id as string),
    })
  ),
  remove: catchAsync(async (req: Request, res: Response) =>
    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: "Product deleted successfully",
      data: await ProductService.remove(req.params.id as string),
    })
  ),
  uploadImages: catchAsync(async (req: Request, res: Response) => {
    const rawFiles = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    if (!rawFiles || rawFiles.length === 0) {
      throw new AppError(status.BAD_REQUEST, "Please select at least one image file to upload");
    }

    const uploaded = await Promise.all(
      rawFiles.map(async (file) => {
        const result = await uploadFileToCloudinary(file.buffer, file.originalname);
        return {
          url: result.secure_url || result.url,
          publicId: result.public_id,
          name: file.originalname,
        };
      })
    );

    sendResponse(res, {
      httpCode: status.OK,
      success: true,
      message: `${uploaded.length} image(s) uploaded to Cloudinary successfully`,
      data: {
        urls: uploaded.map((u) => u.url),
        items: uploaded,
      },
    });
  }),
};