import { DataSource } from "typeorm";
import { env } from "./env.config";
import { User } from "../entities/User.entity";
import { RefreshToken } from "../entities/RefreshToken.entity";
import { Project } from "../entities/Project.entity";
import path from "path";

// export const AppDataSource = new DataSource({
//     type: "postgres",
//     host: env.DB_HOST,
//     port: env.DB_PORT,
//     username: env.DB_USERNAME,
//     password: env.DB_PASSWORD,
//     database: env.DB_NAME,
//     synchronize: env.NODE_ENV === "development",
//     // logging: env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
//     entities: [User, RefreshToken, Project],
//     migrations: ["src/migrations/*.ts"],
//     subscribers: [],
// });

export const AppDataSource = new DataSource({
    type: "postgres",

    url: env.DB_URL,

    ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,

    entities: [
        path.join(__dirname, "..", "entities", "**", "*.entity.{ts,js}"),
    ],

    synchronize: env.NODE_ENV === "development",

    migrations: ["src/migrations/*.ts"],

    extra: {
        prepareThreshold: 0,
    },
});
