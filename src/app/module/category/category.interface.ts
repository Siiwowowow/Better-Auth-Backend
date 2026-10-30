// src/app/module/category/category.interface.ts

export interface ICategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  bgColor?: string | null;
  isActive: boolean;
  productCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateCategoryPayload {
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  bgColor?: string;
  isActive?: boolean;
}

export interface IUpdateCategoryPayload {
  name?: string;
  slug?: string;
  description?: string;
  image?: string;
  bgColor?: string;
  isActive?: boolean;
}
