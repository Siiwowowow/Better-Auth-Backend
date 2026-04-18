// src/modules/user/user.interface.ts

export interface IUpdateUserProfilePayload {
  name?: string;
  email?: string;
  image?: string; // Will store Cloudinary URL
}