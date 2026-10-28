// src/app/module/admin/admin.validation.ts
import { z } from "zod";

export const createAdminZodSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Must be a valid email address"),
  profilePhoto: z.string().url("Profile photo must be a valid URL").optional().or(z.literal("")),
  contactNumber: z.string().min(5).max(20).optional().or(z.literal("")),
});

export const updateAdminZodSchema = z.object({
  admin: z
    .object({
      name: z.string().optional(),
      profilePhoto: z.string().url("Profile photo must be a valid URL").optional().or(z.literal("")),
      contactNumber: z.string().min(5).max(20).optional().or(z.literal("")),
    })
    .optional(),
  name: z.string().optional(),
  profilePhoto: z.string().url().optional().or(z.literal("")),
  contactNumber: z.string().min(5).max(20).optional().or(z.literal("")),
});
