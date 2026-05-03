import "reflect-metadata";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { env } from "./config/env.config";

import { AppDataSource } from "./config/db.config";
import "./config/passport.config";
import authRoutes from "./modules/auth/auth.routes";
import { errorHandler } from "./middleware/error.middleware";

const app = express();


app.use(helmet());
app.use(
    cors({
        origin: env.FRONTEND_URL,
        credentials: true, // allows cookies to be sent cross-origin
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }),
);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());


app.use("/api/auth", authRoutes);

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

app.use(errorHandler);

const start = async () => {
    try {
        await AppDataSource.initialize();
        console.log("Database connected successfully.");

        app.listen(env.PORT, () => {
            console.log(`Server running on http://localhost:${env.PORT}`);
            console.log(`Environment: ${env.NODE_ENV}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

start();
