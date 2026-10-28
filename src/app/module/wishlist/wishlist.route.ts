import { Router } from "express";
import { Role } from "@prisma/client";
import { checkAuth } from "../../middleware/checkAuth.js";
import { WishlistController } from "./wishlist.controller.js";
const router = Router(); router.use(checkAuth(Role.USER, Role.ADMIN)); router.get("/", WishlistController.list); router.post("/:productId", WishlistController.add); router.delete("/:productId", WishlistController.remove);
export { router as WishlistRoutes };
