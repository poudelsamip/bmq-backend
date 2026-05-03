/**
 * data-source.ts used only by the typeORM CLI for migrations.
 * it intentionally bypasses the full app env validation so migrations
 * can run with only db credentials, without requiring oauth keys.
 *
 * Usage:
 *   npm run migration:run
 *   npm run migration:generate -- src/migrations/MigrationName
 *   npm run migration:revert
 */
import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./entities/User.entity";
import { RefreshToken } from "./entities/RefreshToken.entity";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST ?? "localhost",
    port: parseInt(process.env.DB_PORT ?? "5432", 10),
    username: process.env.DB_USERNAME ?? "postgres",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "bullmqdb",
    synchronize: false,
    logging:
        process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
    entities: [User, RefreshToken],
    migrations: ["src/migrations/*.ts"],
    subscribers: [],
});
