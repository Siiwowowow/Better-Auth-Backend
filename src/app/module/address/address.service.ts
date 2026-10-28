/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import { prisma } from "../../lib/prisma.js";
import AppError from "../../errorHelpers/AppError.js";
const list = (userId: string) => prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
const create = async (userId: string, data: any) => { if (data.isDefault) await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }); return prisma.address.create({ data: { ...data, userId } }); };
const update = async (userId: string, id: string, data: any) => { const found = await prisma.address.findFirst({ where: { id, userId } }); if (!found) throw new AppError(status.NOT_FOUND, "Address not found"); if (data.isDefault) await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }); return prisma.address.update({ where: { id }, data }); };
const remove = async (userId: string, id: string) => { const result = await prisma.address.deleteMany({ where: { id, userId } }); if (!result.count) throw new AppError(status.NOT_FOUND, "Address not found"); };
export const AddressService = { list, create, update, remove };
