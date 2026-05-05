import { DataSource } from "typeorm";
import { env } from "./env.config";
import { User } from "../entities/User.entity";
import { RefreshToken } from "../entities/RefreshToken.entity";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    synchronize: true,
    // logging: env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
    entities: [User, RefreshToken],
    migrations: ["src/migrations/*.ts"],
    subscribers: [],
});
