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
import { requirePro } from "../../middleware/requriePro.middleware";

const router = Router({ mergeParams: true });

router.get("/", authenticate, BullMQController.getQueues);

router.get(
    "/:queueName/stats",
    authenticate,
    validate(getQueueStatsSchema),
    BullMQController.getQueueStats,
);

router.get(
    "/:queueName/jobs",
    authenticate,
    validate(getJobsSchema),
    BullMQController.getJobs,
);

router.get(
    "/:queueName/jobs/:jobId",
    authenticate,
    validate(getJobDetailsSchema),
    BullMQController.getJobDetails,
);

router.post(
    "/:queueName/jobs/:jobId/retry",
    authenticate,
    validate(retryJobSchema),
    BullMQController.retryJob,
);

router.get(
    "/:queueName/jobs/:jobId/flow-tree",
    authenticate,
    requirePro,
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
    authenticate,
    validate(pauseQueueSchema),
    BullMQController.pauseQueueController,
);

router.post(
    "/:queueName/resume",
    authenticate,
    validate(resumeQueueSchema),
    BullMQController.resumeQueueController,
);

router.delete(
    "/:queueName/jobs/:jobId",
    authenticate,
    validate(removeJobSchema),
    BullMQController.removeJobController,
);

router.post(
    "/:queueName/jobs/retry-all",
    authenticate,
    requirePro,
    validate(retryAllFailedJobsSchema),
    BullMQController.retryAllFailedJobsController,
);

router.post(
    "/:queueName/jobs/retry-selected",
    authenticate,
    requirePro,
    validate(retrySelectedJobsSchema),
    BullMQController.retrySelectedJobsController,
);

router.post(
    "/:queueName/clean/completed",
    authenticate,
    requirePro,
    validate(cleanJobsSchema),
    BullMQController.cleanCompletedJobsController,
);

router.post(
    "/:queueName/clean/failed",
    authenticate,
    requirePro,
    validate(cleanJobsSchema),
    BullMQController.cleanFailedJobsController,
);

router.post(
    "/:queueName/drain",
    authenticate,
    requirePro,
    validate(drainQueueSchema),
    BullMQController.drainQueueController,
);

export default router;