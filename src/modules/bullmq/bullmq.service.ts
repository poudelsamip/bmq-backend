import { Job, JobType, Queue } from "bullmq";
import IORedis from "ioredis";
import { getOrCreateQueue } from "./connection.cache";
import { AppError } from "../../utils/AppError";

// BullMQ stores data in Redis using this key pattern:
//      bull:{queueName}:meta       — metadata about the queue
//      bull:{queueName}:waiting    — list of waiting job IDs
//      bull:{queueName}:active     — list of active job IDs
//      bull:{queueName}:failed     — sorted set of failed job IDs
//      bull:{queueName}:completed  — sorted set of completed job IDs
//      bull:{queueName}:1          — hash containing full job data

export const getQueues = async (redisUrl: string) => {
    const client = new IORedis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true, // only connect after we call a command
    });

    try {
        await client.connect();

        const keys = await client.keys("bull:*:meta");

        const queues = keys.map((key) => key.split(":")[1]);

        return queues;
    } finally {
        // we close connection no matter it ran successfully or error occurred
        await client.quit();
    }
};

// returns job counts for all states of a queue
export const getQueueStats = async (
    projectId: string,
    queueName: string,
    redisUrl: string,
) => {
    const queue = getOrCreateQueue(projectId, queueName, redisUrl);

    const [counts, isPaused] = await Promise.all([
        queue.getJobCounts(
            "waiting",
            "active",
            "completed",
            "failed",
            "delayed",
            "paused",
        ),
        queue.isPaused(),
    ]);

    return { queueName, counts, isPaused };
};

export type JobState =
    | "waiting"
    | "active"
    | "completed"
    | "failed"
    | "delayed";

export type JobStateFilter = JobState | JobState[] | "all";

export const getJobDetails = async (
    projectId: string,
    queueName: string,
    redisUrl: string,
    jobId: string,
) => {
    const queue = getOrCreateQueue(projectId, queueName, redisUrl);

    const job = await queue.getJob(jobId);

    if (!job) {
        throw new AppError(404, "Job not found");
    }

    const [state, logs] = await Promise.all([
        job.getState(),
        queue.getJobLogs(job.id!, 0, 50), // limit logs
    ]);

    const duration =
        job.finishedOn && job.processedOn
            ? job.finishedOn - job.processedOn
            : null;

    return {
        id: job.id,
        name: job.name,
        queueName: job.queueName,
        state,

        payload: job.data,
        result: job.returnvalue,

        error: {
            message: job.failedReason,
            stack: job.stacktrace,
        },

        attempts: {
            made: job.attemptsMade,
            max: job.opts?.attempts,
        },

        timing: {
            createdAt: job.timestamp,
            processedAt: job.processedOn,
            finishedAt: job.finishedOn,
            duration,
        },

        config: {
            delay: job.opts?.delay,
            priority: job.opts?.priority,
            backoff: job.opts?.backoff,
            removeOnComplete: job.opts?.removeOnComplete,
            removeOnFail: job.opts?.removeOnFail,
        },

        relations: {
            parent: job.parent,
        },

        progress: job.progress,
        logs: logs.logs,
    };
};

export const getJobs = async (
    projectId: string,
    queueName: string,
    redisUrl: string,
    state: JobStateFilter = "all",
    page: number = 0,
    pageSize = 50,
) => {
    const queue = getOrCreateQueue(projectId, queueName, redisUrl);

    const start = page * pageSize;
    const end = start + pageSize - 1;

    const states: JobType[] =
        state === "all"
            ? ["waiting", "active", "completed", "failed", "delayed"]
            : Array.isArray(state)
              ? state
              : [state];

    const jobs = await queue.getJobs(states, 0, pageSize * (page + 1));

    const sorted = jobs.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

    const paginated = sorted.slice(start, end + 1);

    const data = await Promise.all(
        paginated.map(async (job) => {
            const duration =
                job.finishedOn && job.processedOn
                    ? job.finishedOn - job.processedOn
                    : null;
            
            const state = await job.getState();

            return {
                id: job.id,
                name: job.name,
                queueName: job.queueName,

                state,

                attemptsMade: job.attemptsMade,

                timestamp: job.timestamp,
                processedOn: job.processedOn,
                finishedOn: job.finishedOn,
                duration,

                // minimal error info for table
                failedReason: job.failedReason,

                // useful for UI linking
                parent: job.parent,

                isFailed: state === "failed",
                isCompleted: state === "completed",
            };
        }),
    );

    return {
        jobs: data,
        pagination: { page, pageSize, hasMore: sorted.length > end + 1 },
    };
};

export const retryJob = async (
    projectId: string,
    queueName: string,
    redisUrl: string,
    jobId: string,
) => {
    const queue = getOrCreateQueue(projectId, queueName, redisUrl);

    const job = await queue.getJob(jobId);

    if (!job) {
        throw new AppError(400, "Job not found");
    }

    // moves from failed to waiting
    await job.retry();

    return { success: true };
};

type TreeNode = {
    id: string;
    name: string;
    queueName: string;
    status: string;
    failedReason?: string;
    attemptsMade: number;
    timestamp: number;
    children: TreeNode[];
};

const getStatus = (job: Job) => {
    if (job.failedReason) return "failed";
    if (job.finishedOn) return "completed";
    if (job.processedOn) return "active";
    return "waiting";
};

const buildNode = async (job: Job, queueName: string): Promise<TreeNode> => {
    const children = await job.getChildrenValues();

    const childNodes = await Promise.all(
        Object.values(children).map((child: Job) =>
            buildNode(child, child.queueName),
        ),
    );

    return {
        id: job.id!,
        name: job.name,
        queueName,
        status: getStatus(job),
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        children: childNodes,
    };
};

export const buildFlowTree = async (
    projectId: string,
    redisUrl: string,
    queueName: string,
    rootJobId: string,
) => {
    const queue = getOrCreateQueue(projectId, queueName, redisUrl);

    const rootJob = await queue.getJob(rootJobId);
    if (!rootJob) {
        throw new AppError(404, "Root job not found");
    }

    const tree = await buildNode(rootJob, queueName);

    return tree;
};

export const pauseQueue = async (
    projectId: string,
    queueName: string,
    redisUrl: string,
) => {
    const queue = getOrCreateQueue(projectId, queueName, redisUrl);

    await queue.pause();

    return { success: true };
};

export const resumeQueue = async (
    projectId: string,
    queueName: string,
    redisUrl: string,
) => {
    const queue = getOrCreateQueue(projectId, queueName, redisUrl);

    await queue.resume();

    return { success: true };
};

// ── New Tier 1 service functions ──────────────────────────────────────────────

export const removeJob = async (
    projectId: string,
    queueName: string,
    redisUrl: string,
    jobId: string,
) => {
    const queue = getOrCreateQueue(projectId, queueName, redisUrl);

    const job = await queue.getJob(jobId);

    if (!job) {
        throw new AppError(404, "Job not found");
    }

    await job.remove();

    return { success: true };
};

export type RetryAllSummary = {
    total: number;
    retried: number;
    skipped: number;
    failed: number;
};

export const retryAllFailedJobs = async (
    projectId: string,
    queueName: string,
    redisUrl: string,
): Promise<RetryAllSummary> => {
    const queue = getOrCreateQueue(projectId, queueName, redisUrl);

    const failedJobs = await queue.getFailed();

    const results = await Promise.allSettled(
        failedJobs.map((job) => job.retry()),
    );

    let retried = 0;
    let failed = 0;

    for (const result of results) {
        if (result.status === "fulfilled") {
            retried++;
        } else {
            failed++;
        }
    }

    return {
        total: failedJobs.length,
        retried,
        skipped: 0,
        failed,
    };
};

export type JobRetryOutcome = {
    jobId: string;
    status: "retried" | "skipped" | "failed";
    reason?: string;
};

export type RetrySelectedSummary = {
    total: number;
    retried: number;
    skipped: number;
    failed: number;
    results: JobRetryOutcome[];
};

export const retrySelectedJobs = async (
    projectId: string,
    queueName: string,
    redisUrl: string,
    jobIds: string[],
): Promise<RetrySelectedSummary> => {
    const queue = getOrCreateQueue(projectId, queueName, redisUrl);

    // Deduplicate job IDs while preserving order
    const uniqueIds = [...new Set(jobIds)];

    const outcomes = await Promise.allSettled(
        uniqueIds.map(async (id): Promise<JobRetryOutcome> => {
            const job = await queue.getJob(id);

            if (!job) {
                return { jobId: id, status: "skipped", reason: "Job not found" };
            }

            const state = await job.getState();
            if (state !== "failed") {
                return {
                    jobId: id,
                    status: "skipped",
                    reason: `Job is in state "${state}", not "failed"`,
                };
            }

            await job.retry();
            return { jobId: id, status: "retried" };
        }),
    );

    const results: JobRetryOutcome[] = [];
    let retried = 0;
    let skipped = 0;
    let failed = 0;

    for (const outcome of outcomes) {
        if (outcome.status === "fulfilled") {
            results.push(outcome.value);
            if (outcome.value.status === "retried") retried++;
            else skipped++;
        } else {
            // Promise itself rejected (unexpected error)
            failed++;
            results.push({
                jobId: "unknown",
                status: "failed",
                reason: String(outcome.reason),
            });
        }
    }

    return {
        total: uniqueIds.length,
        retried,
        skipped,
        failed,
        results,
    };
};

export type CleanJobsResult = {
    removed: number;
};

export const cleanJobs = async (
    projectId: string,
    queueName: string,
    redisUrl: string,
    type: "completed" | "failed",
    grace = 0,
    limit = 0,
): Promise<CleanJobsResult> => {
    const queue = getOrCreateQueue(projectId, queueName, redisUrl);

    const removed = await queue.clean(grace, limit, type);

    return { removed: removed.length };
};

export const drainQueue = async (
    projectId: string,
    queueName: string,
    redisUrl: string,
) => {
    const queue = getOrCreateQueue(projectId, queueName, redisUrl);

    await queue.drain();

    return { success: true };
};