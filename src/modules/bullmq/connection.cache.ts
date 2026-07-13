import { Queue } from "bullmq";
import IORedis from "ioredis";

/**
 * Everything we cache per project:
 * - one shared Redis connection (one TCP socket) reused by ALL of this
 *   project's queues, instead of every queue opening its own socket
 * - a map of that project's BullMQ Queue objects, keyed by queue name,
 *   so repeated calls for the same queue don't recreate it
 * - a timestamp used to detect idle projects so we can free their
 *   resources (see evictStaleConnections below)
 */
interface ProjectConnection {
    redisConnection: IORedis;
    queues: Map<string, Queue>;
    lastAccessedAt: number;
}

// Main in-memory cache: projectId -> that project's connection + queues.
// This is a module-level singleton (lives in process memory only, not
// persisted anywhere), so every part of the app importing this file
// shares the same cache for the life of the process.
//
// Example shape at runtime:
// {
//   "project_101": {
//     redisConnection: <1 shared IORedis socket>,
//     lastAccessedAt: 1714945000000,
//     queues: { "email-queue": <Queue>, "image-queue": <Queue> }
//   },
//   "project_102": {
//     redisConnection: <1 shared IORedis socket>,
//     lastAccessedAt: 1714945800000,
//     queues: { "webhooks": <Queue> }
//   }
// }
const projectConnectionCache = new Map<string, ProjectConnection>();

// How long a project can sit unused before its connection gets closed
// and evicted from the cache. Prevents idle projects from holding open
// Redis sockets forever.
const CONNECTION_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Returns the BullMQ Queue for (projectId, queueName), creating whatever
 * is missing along the way:
 *   - no project entry yet -> open a new shared Redis connection for it
 *   - project entry exists but not this queue yet -> create the Queue,
 *     reusing the project's existing shared connection (no new socket)
 *   - both already exist -> just return the cached Queue
 *
 * Also bumps lastAccessedAt on every call, which is how
 * evictStaleConnections knows a project is still "alive".
 *
 * Safe to call repeatedly with the same arguments — it's idempotent
 * after the first call for a given (projectId, queueName) pair.
 */
export const getOrCreateQueue = (
    projectId: string,
    queueName: string,
    redisUrl: string,
) => {
    if (!projectConnectionCache.has(projectId)) {
        const redisConnection = new IORedis(redisUrl);
        redisConnection.on("error", (err) => {
            console.error(`[Project ${projectId}] Redis connection error:`, err.message);
        });

        projectConnectionCache.set(projectId, {
            redisConnection,
            queues: new Map(),
            lastAccessedAt: Date.now(),
        });
    }

    const projectConnection = projectConnectionCache.get(projectId)!;
    projectConnection.lastAccessedAt = Date.now();

    if (!projectConnection.queues.has(queueName)) {
        const queue = new Queue(queueName, {
            // Reuse the project's single shared connection instead of
            // passing raw connection options — passing options here
            // would make BullMQ open a brand new socket per queue.
            connection: projectConnection.redisConnection,
        });

        projectConnection.queues.set(queueName, queue);
    }

    return projectConnection.queues.get(queueName)!;
};

/**
 * Fully shuts down one project's resources: closes all of its BullMQ
 * Queue objects, then quits the shared Redis connection, then removes
 * the project from the cache.
 *
 * Both eviction paths below (idle timeout and explicit project
 * deletion) need to do exactly this sequence, so it lives here once
 * instead of being duplicated.
 *
 * Ordering matters:
 *
 * 1. The cache entry is deleted FIRST, before anything async happens.
 *    Everything after this point involves an `await`, which yields
 *    control back to the event loop — if another request came in for
 *    this same projectId during that window and the entry was still
 *    in the cache, getOrCreateQueue would hand back a connection that
 *    is in the middle of being closed. Deleting the entry up front
 *    means any such request just gets a cache miss and creates a
 *    fresh connection instead, which is what we want.
 *
 * 2. Queues are closed BEFORE the connection is quit. A BullMQ Queue
 *    keeps its own internal state/listeners on top of the connection
 *    it was given; killing the socket out from under it first would
 *    make it error out instead of shutting down cleanly.
 *
 * 3. Failures are caught and logged rather than thrown, for both the
 *    queue closes and the connection quit. This function is called in
 *    a loop over many projects (see evictStaleConnections) — one
 *    project having a broken connection shouldn't stop the rest of
 *    the projects in that loop from being cleaned up.
 */
const teardownProjectConnection = async (
    projectId: string,
    projectConnection: ProjectConnection,
) => {
    projectConnectionCache.delete(projectId);

    const queueCloseResults = await Promise.allSettled(
        [...projectConnection.queues.values()].map((queue) => queue.close()),
    );

    for (const result of queueCloseResults) {
        if (result.status === "rejected") {
            console.error(
                `Failed to close a queue for project ${projectId}:`,
                result.reason,
            );
        }
    }

    try {
        // .quit() waits for pending commands to finish then closes
        // cleanly (vs .disconnect(), which is abrupt).
        await projectConnection.redisConnection.quit();
    } catch (err) {
        console.error(
            `Failed to quit redis connection for project ${projectId}:`,
            err,
        );
    }
};

/**
 * Sweeps the whole cache and tears down any project that hasn't been
 * accessed (via getOrCreateQueue) in over CONNECTION_TTL_MS.
 *
 * Meant to be called periodically by something outside this file
 * (e.g. a setInterval or cron job) — it does not schedule itself.
 *
 * Without this, every project that ever queued a single job would
 * keep its Redis connection open forever, even years after its last
 * use.
 */
export const evictStaleConnections = async () => {
    const now = Date.now();

    for (const [
        projectId,
        projectConnection,
    ] of projectConnectionCache.entries()) {
        if (now - projectConnection.lastAccessedAt > CONNECTION_TTL_MS) {
            await teardownProjectConnection(projectId, projectConnection);
        }
    }
};

/**
 * Immediately tears down a project's connection + queues, for when a
 * project is explicitly deleted by the user.
 *
 * This exists separately from evictStaleConnections because waiting
 * for the idle TTL isn't good enough here: if a project is deleted,
 * its Redis connection should be freed right away, not left open for
 * up to CONNECTION_TTL_MS just because the delete event doesn't
 * naturally trigger the idle-timeout check.
 *
 * No-op if the project has no cached connection (e.g. it was deleted
 * before ever queuing a job, or was already evicted for being idle).
 */
export const removeProjectConnections = async (projectId: string) => {
    if (!projectConnectionCache.has(projectId)) {
        return;
    }

    const projectConnection = projectConnectionCache.get(projectId)!;
    await teardownProjectConnection(projectId, projectConnection);
};
