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
    

  image: z.string().url().optional(), // Will be set by middleware
});

export const UserValidation = {
  updateUserProfileZodSchema,
};