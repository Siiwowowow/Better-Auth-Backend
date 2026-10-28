import express, { Application, Request, RequestHandler, Response } from "express";
import { toNodeHandler } from "better-auth/node";
import { notFound } from "./app/middleware/notFound.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import qs from "qs"
import { envVars } from "./app/config/env.js";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler.js";
import { rateLimit } from "./app/middleware/rateLimit.js";
import { graphqlHandler } from "./app/graphql/server.js";
import { auth } from "./app/lib/auth.js";
import { IndexRoutes } from "./app/routes/index.js";


const app: Application = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.set("query parser", (str : string) => qs.parse(str));

app.set("view engine", "ejs");
app.set("views",path.resolve(process.cwd(), `src/app/templates`) )
// Enable CORS with credentials
app.use(cors({
    origin : [envVars.FRONTEND_URL, envVars.BETTER_AUTH_URL, "http://localhost:3000", "http://localhost:5000"],
    credentials : true,
    methods : ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders : ["Content-Type", "Authorization"]
}))
const authRateLimit = rateLimit(20, 60_000);

// Small baseline hardening without adding a runtime dependency: browsers must
// not MIME-sniff responses, embed this API, or receive overly permissive CSP.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.use("/api/auth", authRateLimit, toNodeHandler(auth));

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Middleware to parse JSON bodies
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/api/v1", IndexRoutes);

app.use("/graphql", authRateLimit, (req, res, next) => {
  (req as Request & { graphqlResponse?: Response }).graphqlResponse = res;
  next();
}, graphqlHandler as unknown as RequestHandler);

// Basic route
app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript + Express!');
});
app.use(notFound);
app.use(globalErrorHandler);
export default app;
