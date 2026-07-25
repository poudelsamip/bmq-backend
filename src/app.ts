import "reflect-metadata";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { env } from "./config/env.config";

import { AppDataSource } from "./config/db.config";
import "./config/passport.config";
import authRoutes from "./modules/auth/auth.routes";
import projectRoutes from "./modules/projects/project.routes";
import bullmqRoutes from "./modules/bullmq/bullmq.routes";
import { errorHandler } from "./middleware/error.middleware";
import { evictStaleConnections } from "./modules/bullmq/connection.cache";

const app = express();
app.set("trust proxy", 1);

app.use(helmet());
app.use(
    cors({
        origin: env.FRONTEND_URL,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }),
);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/project", projectRoutes);
app.use("/api/project/:projectId/queues", bullmqRoutes);

// Health check
app.get("/health", (_req, res) => {
    res.json({
        success: true,
        message: "Server is running.",
        data: { uptime: process.uptime() },
    });
});

// 404 handler
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found.",
        data: null,
    });
});

setInterval(evictStaleConnections, 5 * 60 * 1000);

app.use(errorHandler);

const start = async () => {
    try {
        await AppDataSource.initialize();
        console.log("\n---------------------------------\n");
        console.log("DATABASE CONNECTED SUCCSESFULLY");

        app.listen(env.PORT, () => {
            console.log(`SERVER: http://localhost:${env.PORT}`);
            console.log(`ENVIRONMENT: ${env.NODE_ENV}`);
            console.log("\n---------------------------------\n");
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

start();
