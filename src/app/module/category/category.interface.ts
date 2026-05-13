// src/app/module/category/category.interface.ts

export interface ICategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateCategoryPayload {
  name: string;
  description?: string;
  image?: string;
}

export interface IUpdateCategoryPayload {
  name?: string;
  description?: string;
  image?: string;
  isActive?: boolean;
}
