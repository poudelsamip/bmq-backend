import { Queue } from "bullmq";

interface CachedProject {
    queues: Map<string, Queue>;
    lastAccessed: number;
}

// main brain of the app. stores all connection
// structure: Map<ProjectId, { queues: Map<QueueName, Queue>, lastAccessed: Timestamp }>
/*
    {
        "project_101": {
            "lastAccessed": 1714945000000,
            "queues": {
                "email-queue": "Live Connection (Socket 1)",
                "image-queue": "Live Connection (Socket 2)"
            }
        },
        "project_102": {
            "lastAccessed": 1714945800000,
            "queues": {
                "webhooks": "Live Connection (Socket 3)"
            }
        }
    }
*/

const cache = new Map<string, CachedProject>();
const TTL_MS = 10 * 60 * 1000;

export const getCachedQueue = (
    projectId: string,
    queueName: string,
    redisUrl: string,
) => {
    // if this projectID has no cache entry yet, create new
    if (!cache.has(projectId)) {
        cache.set(projectId, {
            queues: new Map(),
            lastAccessed: Date.now(),
        });
    }

    // update last accessed every time this project is used
    const cached = cache.get(projectId)!;
    cached.lastAccessed = Date.now();

    // if we do not have Queue for this queueName yet then create new
    if (!cached.queues.has(queueName)) {
        const queue = new Queue(queueName, {
            connection: { url: redisUrl },
        });

        cached.queues.set(queueName, queue);
    }

    return cached.queues.get(queueName)!;
};

export const evictStaleConnection = async () => {
    const now = Date.now();

    for (const [projectId, cached] of cache.entries()) {
        // check if connection was last accessed 10 minutes ago
        if (now - cached.lastAccessed > TTL_MS) {
            // close every queue connection of the project
            for (const queue of cached.queues.values()) {
                await queue.close();
            }

            // delete entire project
            cache.delete(projectId);
        }
    }
};

// if user deletes project then remove project from cache
// if not then cache would hold dead connection until TTL_MS expires
export const invalidateProjectCache = async (projectId: string) => {
    if (!cache.has(projectId)) {
        return;
    }

    const cached = cache.get(projectId)!;

    for (const queue of cached.queues.values()) {
        await queue.close();
    }

    cache.delete(projectId);
};
