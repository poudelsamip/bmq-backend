import { Queue } from "bullmq";
import IORedis from "ioredis";

interface ProjectConnection {
    redisConnection: IORedis;
    queues: Map<string, Queue>;
    lastAccessedAt: number;
}

// main brain of the app. stores all project redis connections
// structure: Map<ProjectId, { redisConnection: IORedis, queues: Map<QueueName, Queue>, lastAccessedAt: Timestamp }>
/*
    {
        "project_101": {
            "redisConnection": "Shared IORedis Instance (1 TCP Socket)",
            "lastAccessedAt": 1714945000000,
            "queues": {
                "email-queue": "BullMQ Queue Object",
                "image-queue": "BullMQ Queue Object"
            }
        },
        "project_102": {
            "redisConnection": "Shared IORedis Instance (1 TCP Socket)",
            "lastAccessedAt": 1714945800000,
            "queues": {
                "webhooks": "BullMQ Queue Object"
            }
        }
    }
*/

const projectConnectionCache = new Map<string, ProjectConnection>();
const CONNECTION_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const getOrCreateQueue = (
    projectId: string,
    queueName: string,
    redisUrl: string,
) => {
    // if this projectID has no entry yet, create new
    if (!projectConnectionCache.has(projectId)) {
        projectConnectionCache.set(projectId, {
            redisConnection: new IORedis(redisUrl),
            queues: new Map(),
            lastAccessedAt: Date.now(),
        });
    }

    // update lastAccessedAt every time this project is used
    const projectConnection = projectConnectionCache.get(projectId)!;
    projectConnection.lastAccessedAt = Date.now();

    // if we do not have Queue for this queueName yet then create new
    if (!projectConnection.queues.has(queueName)) {
        const queue = new Queue(queueName, {
            connection: projectConnection.redisConnection,
        });

        projectConnection.queues.set(queueName, queue);
    }

    return projectConnection.queues.get(queueName)!;
};

export const evictStaleConnections = async () => {
    const now = Date.now();

    for (const [
        projectId,
        projectConnection,
    ] of projectConnectionCache.entries()) {
        // check if connection was last accessed 10 minutes ago
        if (now - projectConnection.lastAccessedAt > CONNECTION_TTL_MS) {
            await projectConnection.redisConnection.quit();
            projectConnectionCache.delete(projectId);
        }
    }
};

// if user deletes project then remove project from store
// if not then store would hold dead connection until CONNECTION_TTL_MS expires
export const removeProjectConnections = async (projectId: string) => {
    if (!projectConnectionCache.has(projectId)) {
        return;
    }

    const projectConnection = projectConnectionCache.get(projectId)!;
    await projectConnection.redisConnection.quit();
    projectConnectionCache.delete(projectId);
};
