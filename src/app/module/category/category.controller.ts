// src/app/module/category/category.controller.ts
import { Request, Response } from "express";
import statusCode from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { CategoryService } from "./category.service.js";

const createCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoryService.createCategory(req.body);
  
  sendResponse(res, {
    httpCode: statusCode.CREATED,
    success: true,
    message: "Category created successfully",
    data: result,
  });
});

const getAllCategories = catchAsync(async (req: Request, res: Response) => {
  const includeInactive = req.query.includeInactive === 'true';
  const result = await CategoryService.getAllCategories(includeInactive);

  sendResponse(res, {
    httpCode: statusCode.OK,
    success: true,
    message: "Categories fetched successfully",
    data: result,
  });
});

const getCategoryById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CategoryService.getCategoryById(id as string);
  
  sendResponse(res, {
    httpCode: statusCode.OK,
    success: true,
    message: "Category fetched successfully",
    data: result,
  });
});

const getCategoryBySlug = catchAsync(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const result = await CategoryService.getCategoryBySlug(slug as string);
  
  sendResponse(res, {
    httpCode: statusCode.OK,
    success: true,
    message: "Category fetched successfully",
    data: result,
  });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CategoryService.updateCategory(id as string, req.body);
  
  sendResponse(res, {
    httpCode: statusCode.OK,
    success: true,
    message: "Category updated successfully",
    data: result,
  });
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CategoryService.deleteCategory(id as string);
  
  sendResponse(res, {
    httpCode: statusCode.OK,
    success: true,
    message: "Category deleted successfully",
    data: result,
  });
});

export const CategoryController = {
  createCategory,
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
};
