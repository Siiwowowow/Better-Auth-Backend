import { Router } from "express";
import { Role } from "@prisma/client";
import { checkAuth } from "../../middleware/checkAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { AddressController } from "./address.controller.js";
import { addressSchema, addressUpdateSchema } from "./address.validation.js";
const router = Router(); router.use(checkAuth(Role.USER, Role.ADMIN));
router.get("/", AddressController.list); router.post("/", validateRequest(addressSchema), AddressController.create); router.patch("/:id", validateRequest(addressUpdateSchema), AddressController.update); router.delete("/:id", AddressController.remove);
export { router as AddressRoutes };
