import { Request, Response, NextFunction, RequestHandler } from "express";
import { getProjectWithRedisUrl } from "../projects/project.service";
import * as BullMQService from "./bullmq.service";
import {
    GetFlowTreeParams,
    GetJobDetailsParams,
    GetJobsParams,
    GetJobsQuery,
    RetryJobParams,
    RemoveJobParams,
    RetryAllFailedParams,
    RetrySelectedParams,
    RetrySelectedBody,
    CleanJobsParams,
    CleanJobsBody,
    DrainQueueParams,
} from "./bullmq.schema";
import { AuthUser } from "../../interfaces/auth.interface";
import { Plans } from "../../entities/User.entity";

export const getRedisUrl = async (req: Request<any, any, any, any>) => {
    const projectId = req.params.id;
    const userId = (req.user as AuthUser).id;

    const { redisUrl } = await getProjectWithRedisUrl(projectId, userId);

    return { projectId, redisUrl };
};

// GET /api/projects/:projectId/queues
export const getQueues = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { redisUrl } = await getRedisUrl(req);

        const queues = await BullMQService.getQueues(redisUrl);

        return res.status(200).json({
            success: true,
            message: "Queue names fetched successfully",
            data: queues,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/projects/:projectId/queues/:queueName/stats
export const getQueueStats = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { projectId, redisUrl } = await getRedisUrl(req);
        const { queueName } = req.params;

        const stats = await BullMQService.getQueueStats(
            projectId,
            queueName,
            redisUrl,
        );

        return res.status(200).json({
            success: true,
            message: "Queue stats fetched successfully",
            data: stats,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/projects/:projectId/queues/:queueName/jobs
export const getJobs = (async (
    req: Request<GetJobsParams, {}, {}, GetJobsQuery>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { projectId, redisUrl } = await getRedisUrl(req);
        const { queueName } = req.params;
        const { state, page, pageSize } = req.query;

        // Enforce free-tier job visibility limit server-side
        const user = req.user as AuthUser;
        const jobLimit = user.plan === Plans.PRO ? undefined : 30;

        const jobs = await BullMQService.getJobs(
            projectId,
            queueName,
            redisUrl,
            state,
            page,
            pageSize,
            jobLimit,
        );

        return res.status(200).json({
            success: true,
            message: "Jobs fetched successfully",
            data: jobs,
        });
    } catch (error) {
        next(error);
    }
}) as unknown as RequestHandler;

// GET /api/projects/:projectId/queues/:queueName/jobs/:jobId
export const getJobDetails = async (
    req: Request<GetJobDetailsParams>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { projectId, redisUrl } = await getRedisUrl(req);
        const { queueName, jobId } = req.params;

        const job = await BullMQService.getJobDetails(
            projectId,
            queueName,
            redisUrl,
            jobId,
        );

        return res.status(200).json({
            success: true,
            message: "Job details fetched successfully",
            data: job,
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/projects/:projectId/queues/:queueName/jobs/:jobId/retry
export const retryJob = (async (
    req: Request<RetryJobParams, {}, {}, GetJobsQuery>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { projectId, redisUrl } = await getRedisUrl(req);
        const { queueName, jobId } = req.params;

        const result = await BullMQService.retryJob(
            projectId,
            queueName,
            redisUrl,
            jobId,
        );

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message:
                    "Job could not be retried. It may already be active or completed.",
            });
        }

        return res.status(200).json({
            success: true,
            message:
                "Job has been successfully moved to the waiting queue for retry.",
        });
    } catch (error) {
        next(error);
    }
}) as unknown as RequestHandler;

// GET /api/projects/:projectId/queues/:queueName/jobs/:jobId/flow-tree

// Returns the full parent-child job tree across all queues.
// shows how a multi-step BullMQ flow broke down,
// which child failed, and what the error was.

export const getFlowTree = async (
    req: Request<GetFlowTreeParams>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { projectId, redisUrl } = await getRedisUrl(req);

        const { queueName, jobId } = req.params;

        const tree = await BullMQService.buildFlowTree(
            projectId,
            redisUrl,
            queueName,
            jobId,
        );

        return res.status(200).json({
            success: true,
            message: "Flow tree generated successfully",
            data: tree,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/projects/:projectId/queues/stream  (SSE)
// Keeps an HTTP connection open and pushes all queue stat updates every 1 second.
// Also records throughput snapshots and includes throughput data in the payload.
export async function streamAllQueuesStats(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const { projectId, redisUrl } = await getRedisUrl(req);

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        let lastPayload = "";

        const interval = setInterval(async () => {
            try {
                // 1. Get all queues
                const queues = await BullMQService.getQueues(redisUrl);
                
                // 2. Get stats for all queues in parallel
                const statsPromises = queues.map((q) =>
                    BullMQService.getQueueStats(projectId, q, redisUrl)
                );
                
                const statsArray = await Promise.all(statsPromises);

                const payload = JSON.stringify(statsArray);

                if (payload !== lastPayload) {
                    res.write(`data: ${payload}\n\n`);
                    lastPayload = payload;
                }
            } catch {
                res.write(
                    `event: error\ndata: {"message":"Failed to fetch stats"}\n\n`,
                );
            }
        }, 1000);

        req.on("close", async () => {
            clearInterval(interval);
            res.end();
        });
    } catch (err) {
        next(err);
    }
}

// GET /api/projects/:projectId/queues/:queueName/stream  (SSE)

// Keeps an HTTP connection open and pushes queue stat updates every 3 seconds.
// The frontend uses the browser's native EventSource API to consume this.

export async function streamQueueStats(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const { projectId, redisUrl } = await getRedisUrl(req);
        const { queueName } = req.params;

        // These headers transform a normal HTTP response into an SSE stream.
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        // flushHeaders() sends the headers to the client immediately,
        // before any data — this opens the stream. Without this the client
        // would wait until the first data chunk before seeing any headers.
        res.flushHeaders();

        let lastPayload = "";

        const interval = setInterval(async () => {
            try {
                const stats = await BullMQService.getQueueStats(
                    projectId,
                    queueName,
                    redisUrl,
                );
                const payload = JSON.stringify(stats);

                // Only send if something actually changed since last push
                if (payload !== lastPayload) {
                    // SSE format is strictly: "data: {content}\n\n"
                    // The double newline (\n\n) signals the end of one event.
                    // EventSource on the frontend fires an "onmessage" event
                    // each time it receives a complete event (ending in \n\n).
                    res.write(`data: ${payload}\n\n`);
                    lastPayload = payload;
                }
            } catch {
                // If Redis becomes unreachable mid-stream, send an error event
                // and let the client handle it gracefully
                res.write(
                    `event: error\ndata: {"message":"Failed to fetch stats"}\n\n`,
                );
            }
        }, 1000); // poll every 3 seconds

        // When the user closes the browser tab or navigates away,
        // the "close" event fires on the request. We clean up here —
        // clear the interval so we stop polling Redis for a dead connection.
        req.on("close", () => {
            clearInterval(interval);
            res.end();
        });
    } catch (err) {
        next(err);
    }
}

// POST /api/projects/:projectId/queues/:queueName/pause
export const pauseQueueController = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { projectId, redisUrl } = await getRedisUrl(req);
        const { queueName } = req.params;

        const result = await BullMQService.pauseQueue(
            projectId,
            queueName,
            redisUrl,
        );

        return res.status(200).json({
            success: true,
            message: "Queue paused successfully",
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/projects/:projectId/queues/:queueName/resume
export const resumeQueueController = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { projectId, redisUrl } = await getRedisUrl(req);
        const { queueName } = req.params;

        const result = await BullMQService.resumeQueue(
            projectId,
            queueName,
            redisUrl,
        );

        return res.status(200).json({
            success: true,
            message: "Queue resumed successfully",
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

// ── New Tier 1 controllers ────────────────────────────────────────────────────

// DELETE /api/projects/:projectId/queues/:queueName/jobs/:jobId
export const removeJobController = (async (
    req: Request<RemoveJobParams>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { projectId, redisUrl } = await getRedisUrl(req);
        const { queueName, jobId } = req.params;

        await BullMQService.removeJob(projectId, queueName, redisUrl, jobId);

        return res.status(200).json({
            success: true,
            message: "Job removed successfully",
        });
    } catch (error) {
        next(error);
    }
}) as unknown as RequestHandler;

// POST /api/projects/:projectId/queues/:queueName/jobs/retry-all
export const retryAllFailedJobsController = (async (
    req: Request<RetryAllFailedParams>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { projectId, redisUrl } = await getRedisUrl(req);
        const { queueName } = req.params;

        const summary = await BullMQService.retryAllFailedJobs(
            projectId,
            queueName,
            redisUrl,
        );

        return res.status(200).json({
            success: true,
            message: `Retry complete. ${summary.retried} retried, ${summary.failed} failed.`,
            data: summary,
        });
    } catch (error) {
        next(error);
    }
}) as unknown as RequestHandler;

// POST /api/projects/:projectId/queues/:queueName/jobs/retry-selected
export const retrySelectedJobsController = (async (
    req: Request<RetrySelectedParams, {}, RetrySelectedBody>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { projectId, redisUrl } = await getRedisUrl(req);
        const { queueName } = req.params;
        const { jobIds } = req.body;

        const summary = await BullMQService.retrySelectedJobs(
            projectId,
            queueName,
            redisUrl,
            jobIds,
        );

        return res.status(200).json({
            success: true,
            message: `Retry complete. ${summary.retried} retried, ${summary.skipped} skipped, ${summary.failed} failed.`,
            data: summary,
        });
    } catch (error) {
        next(error);
    }
}) as unknown as RequestHandler;

// POST /api/projects/:projectId/queues/:queueName/clean/completed
export const cleanCompletedJobsController = (async (
    req: Request<CleanJobsParams, {}, CleanJobsBody>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { projectId, redisUrl } = await getRedisUrl(req);
        const { queueName } = req.params;
        const { grace, limit } = req.body;

        const result = await BullMQService.cleanJobs(
            projectId,
            queueName,
            redisUrl,
            "completed",
            grace,
            limit,
        );

        return res.status(200).json({
            success: true,
            message: `Removed ${result.removed} completed job(s).`,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}) as unknown as RequestHandler;

// POST /api/projects/:projectId/queues/:queueName/clean/failed
export const cleanFailedJobsController = (async (
    req: Request<CleanJobsParams, {}, CleanJobsBody>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { projectId, redisUrl } = await getRedisUrl(req);
        const { queueName } = req.params;
        const { grace, limit } = req.body;

        const result = await BullMQService.cleanJobs(
            projectId,
            queueName,
            redisUrl,
            "failed",
            grace,
            limit,
        );

        return res.status(200).json({
            success: true,
            message: `Removed ${result.removed} failed job(s).`,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}) as unknown as RequestHandler;

// POST /api/projects/:projectId/queues/:queueName/drain
export const drainQueueController = (async (
    req: Request<DrainQueueParams>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { projectId, redisUrl } = await getRedisUrl(req);
        const { queueName } = req.params;

        await BullMQService.drainQueue(projectId, queueName, redisUrl);

        return res.status(200).json({
            success: true,
            message: "Queue drained successfully. Waiting jobs have been removed.",
        });
    } catch (error) {
        next(error);
    }
}) as unknown as RequestHandler;