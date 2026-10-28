import { Router } from "express";
import { AuthRouters } from "../module/auth/auth.route.js";
import { UserRoutes } from "../module/user/user.route.js";
import { CategoryRoutes } from "../module/category/category.route.js";
import { AdminRoutes } from "../module/admin/admin.route.js";
import { ProductRoutes } from "../module/product/product.route.js";
import { CartRoutes } from "../module/cart/cart.route.js";
import { OrderRoutes } from "../module/order/order.route.js";
import { AddressRoutes } from "../module/address/address.route.js";
import { ReviewRoutes } from "../module/review/review.route.js";
import { WishlistRoutes } from "../module/wishlist/wishlist.route.js";

const router=Router();

 router.use("/auth", AuthRouters);
 router.use("/users", UserRoutes); 
 router.use("/categories", CategoryRoutes);
 router.use("/admins", AdminRoutes);
 router.use("/products", ProductRoutes);
 router.use("/cart", CartRoutes);
 router.use("/orders", OrderRoutes);
 router.use("/addresses", AddressRoutes);
 router.use("/reviews", ReviewRoutes);
 router.use("/wishlists", WishlistRoutes);

export const IndexRoutes=router;
