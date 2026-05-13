import { Router } from "express";
import { AuthRouters } from "../module/auth/auth.route.js";
import { UserRoutes } from "../module/user/user.route.js";
import { CategoryRoutes } from "../module/category/category.route.js";

const router=Router();

 router.use("/auth", AuthRouters);
 router.use("/users", UserRoutes); 
 router.use("/categories", CategoryRoutes);

export const IndexRoutes=router;