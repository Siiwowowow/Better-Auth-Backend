// src/modules/user/user.validation.ts

import z from "zod";

const updateUserProfileZodSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters")
    .optional(),
    
  email: z.string()
    .email("Invalid email format")
    .optional(),
    
  phone: z.string()
    .regex(/^\+?[0-9]{10,15}$/, "Phone number must be 10-15 digits, optionally starting with +")
    .optional(),
    
  address: z.string()
    .max(200, "Address too long")
    .optional(),
    
  city: z.string()
    .max(100, "City name too long")
    .optional(),
    
  country: z.string()
    .max(100, "Country name too long")
    .optional(),
    
  image: z.string().url().optional(), // Will be set by middleware
});

export const UserValidation = {
  updateUserProfileZodSchema,
};