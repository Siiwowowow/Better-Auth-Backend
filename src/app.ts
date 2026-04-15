// backend/src/app.ts (updated CORS)
import cookieParser from "cookie-parser";
import express, { Application, Request, Response } from "express";
import cors from "cors";
import { IndexRoutes } from "./app/routes";
import { notFound } from "./app/middleware/notFound";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./app/lib/auth";

const app: Application = express();

// 🔥 CORS configuration
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Better Auth handler
app.use("/api/auth", toNodeHandler(auth));

// API routes
app.use("/api/v1", IndexRoutes);

// Test route
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "API working",
  });
});

// Error handlers
app.use(globalErrorHandler);
app.use(notFound);

export default app;