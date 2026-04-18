// src/modules/user/user.interface.ts

export interface IUpdateUserProfilePayload {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  image?: string; // Will store Cloudinary URL
}