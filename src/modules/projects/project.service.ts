import { env } from "../../config/env.config";
import { Project } from "../../entities/Project.entity";
import { AppError } from "../../utils/AppError";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { AppDataSource } from "../../config/db.config";
import { CreateProjectDto, UpdateProjectDto } from "./project.schema";
import { Plans } from "../../entities/User.entity";

const ALGORITHM = "aes-256-gcm";

const projectRepo = () => AppDataSource.getRepository(Project);

const getEncryptionKey = () => {
    const key = env.ENCRYPTION_KEY;

    if (!key) {
        throw new AppError(500, "ENCRYPTION_KEY is not set");
    }

    return Buffer.from(key, "hex");
};

const encryptRedisUrl = (plainURL: string) => {
    const key = getEncryptionKey();
    const iv = randomBytes(12);

    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encryptedBuffer = Buffer.concat([
        cipher.update(plainURL, "utf8"),
        cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    const combined = Buffer.concat([authTag, encryptedBuffer]);

    return {
        encrypted: combined.toString("base64"),
        iv: iv.toString("hex"),
    };
};

export const decryptRedisUrl = (encryptedBase64: string, ivHex: string) => {
    const key = getEncryptionKey();

    const iv = Buffer.from(ivHex, "hex");

    const data = Buffer.from(encryptedBase64, "base64");

    const authTag = data.subarray(0, 16);
    const cipherText = data.subarray(16);

    const decipher = createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(cipherText),
        decipher.final(),
    ]);

    return decrypted.toString("utf8");
};

const PLAN_PROJECT_LIMITS: Record<Plans, number> = {
    [Plans.FREE]: 1,
    [Plans.PRO]: 5,
};

export const enforcePlanLimit = async (userId: string, userPlan: Plans) => {
    const count = await projectRepo().count({ where: { userId } });

    const limit = PLAN_PROJECT_LIMITS[userPlan] ?? 1;

    if (count > limit) {
        throw new AppError(
            403,
            `${userPlan} allows up to ${limit} project(s). Please upgrade to add more`,
        );
    }
};

export const createProject = async (
    userId: string,
    userPlan: Plans,
    dto: CreateProjectDto,
) => {
    await enforcePlanLimit(userId, userPlan);

    const { encrypted, iv } = encryptRedisUrl(dto.redis_url);

    const project = await projectRepo().save(
        projectRepo().create({
            userId,
            name: dto.name,
            encryptedRedisUrl: encrypted,
            encryptionIv: iv,
        }),
    );

    const safeProject = {
        id: project.id,
        name: project.name,
        userId: project.userId,
        createdAt: project.createdAt,
    };

    return safeProject;
};

export const getProjects = async (userId: string) => {
    const projects = await projectRepo().find({
        where: { userId },
        order: { createdAt: "DESC" },
    });

    const safeData = projects.map(
        ({ encryptedRedisUrl, encryptionIv, ...safeData }) => safeData,
    );

    return safeData;
};

export const getProject = async (projectId: string, userId: string) => {
    const project = await projectRepo().findOne({
        where: { id: projectId, userId },
    });

    if (!project) {
        throw new AppError(404, "Project Not Found");
    }
    return project;
};

export const getProjectWithRedisUrl = async (
    projectId: string,
    userId: string,
) => {
    const project = await getProject(projectId, userId);

    const redisUrl = decryptRedisUrl(
        project.encryptedRedisUrl,
        project.encryptionIv,
    );

    return { project, redisUrl };
};

export const updateProject = async (
    projectId: string,
    userId: string,
    dto: UpdateProjectDto,
) => {
    const project = await getProject(projectId, userId);

    project.name = dto.name;
    const saved = await projectRepo().save(project);

    const { encryptedRedisUrl, encryptionIv, ...safeData } = saved;
    return safeData;
};

export const deleteProject = async (projectId: string, userId: string) => {
    const project = await getProject(projectId, userId);

    await projectRepo().remove(project);
};
