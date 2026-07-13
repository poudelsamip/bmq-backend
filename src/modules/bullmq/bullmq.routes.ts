import { Router } from "express";
import * as BullMQController from "./bullmq.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
    getFlowTreeSchema,
    getJobDetailsSchema,
    getJobsSchema,
    getQueueStatsSchema,
    retryJobSchema,
    streamQueueStatsSchema,
    pauseQueueSchema,
    resumeQueueSchema,
    removeJobSchema,
    retryAllFailedJobsSchema,
    retrySelectedJobsSchema,
    cleanJobsSchema,
    drainQueueSchema,
} from "./bullmq.schema";
import { sseAuth } from "../../middleware/sseAuth.middleware";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/", BullMQController.getQueues);

router.get(
    "/:queueName/stats",
    validate(getQueueStatsSchema),
    BullMQController.getQueueStats,
);

router.get(
    "/:queueName/jobs",
    validate(getJobsSchema),
    BullMQController.getJobs,
);

router.get(
    "/:queueName/jobs/:jobId",
    validate(getJobDetailsSchema),
    BullMQController.getJobDetails,
);

router.post(
    "/:queueName/jobs/:jobId/retry",
    validate(retryJobSchema),
    BullMQController.retryJob,
);

router.get(
    "/:queueName/jobs/:jobId/flow-tree",
    validate(getFlowTreeSchema),
    BullMQController.getFlowTree,
);

router.get(
    "/stream",
    sseAuth,
    BullMQController.streamAllQueuesStats,
);

router.get(
    "/:queueName/stream",
    sseAuth,
    validate(streamQueueStatsSchema),
    BullMQController.streamQueueStats,
);

router.post(
    "/:queueName/pause",
    validate(pauseQueueSchema),
    BullMQController.pauseQueueController,
);

router.post(
    "/:queueName/resume",
    validate(resumeQueueSchema),
    BullMQController.resumeQueueController,
);

// DELETE /:queueName/jobs/:jobId
router.delete(
    "/:queueName/jobs/:jobId",
    validate(removeJobSchema),
    BullMQController.removeJobController,
);

// POST /:queueName/jobs/retry-all  — must be before /:queueName/jobs/:jobId
// to avoid Express matching "retry-all" as a :jobId
router.post(
    "/:queueName/jobs/retry-all",
    validate(retryAllFailedJobsSchema),
    BullMQController.retryAllFailedJobsController,
);

// POST /:queueName/jobs/retry-selected
router.post(
    "/:queueName/jobs/retry-selected",
    validate(retrySelectedJobsSchema),
    BullMQController.retrySelectedJobsController,
);

// POST /:queueName/clean/completed
router.post(
    "/:queueName/clean/completed",
    validate(cleanJobsSchema),
    BullMQController.cleanCompletedJobsController,
);

// POST /:queueName/clean/failed
router.post(
    "/:queueName/clean/failed",
    validate(cleanJobsSchema),
    BullMQController.cleanFailedJobsController,
);

// POST /:queueName/drain
router.post(
    "/:queueName/drain",
    validate(drainQueueSchema),
    BullMQController.drainQueueController,
);

export default router;
