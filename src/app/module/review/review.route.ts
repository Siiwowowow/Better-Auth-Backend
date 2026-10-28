import { Router } from "express";
import { Role } from "@prisma/client";
import { checkAuth } from "../../middleware/checkAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { ReviewController } from "./review.controller.js";
import { reviewSchema, updateReviewSchema } from "./review.validation.js";

const router = Router();
router.get("/", ReviewController.list);
router.use(checkAuth(Role.USER, Role.ADMIN));
router.post("/", validateRequest(reviewSchema), ReviewController.upsert);
router.put("/", validateRequest(reviewSchema), ReviewController.upsert);
router.patch("/:id", checkAuth(Role.ADMIN), validateRequest(updateReviewSchema), ReviewController.update);
router.delete("/:id", ReviewController.remove);

export { router as ReviewRoutes };
