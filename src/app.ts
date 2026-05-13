import express, { Application, Request, Response } from "express";
import { IndexRoutes } from "./app/routes/index.js";
import { notFound } from "./app/middleware/notFound.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./app/lib/auth.js";
import path from "path";
import qs from "qs"
import { envVars } from "./app/config/env.js";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler.js";


const app: Application = express();
app.set("query parser", (str : string) => qs.parse(str));

app.set("view engine", "ejs");
app.set("views",path.resolve(process.cwd(), `src/app/templates`) )
app.post("/webhook", express.raw({ type: "application/json" }),async(req:Request,res:Response)=>{
  console.log("webhook received",req.body)
  res.status(200).json({received:true})

})

// Enable CORS with credentials
app.use(cors({
    origin : [envVars.FRONTEND_URL, envVars.BETTER_AUTH_URL, "http://localhost:3000", "http://localhost:5000"],
    credentials : true,
    methods : ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders : ["Content-Type", "Authorization"]
}))
app.use("/api/auth", toNodeHandler(auth))

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1/", IndexRoutes);

// Basic route
app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript + Express!');
});
app.use(globalErrorHandler)
app.use(notFound)
export default app;