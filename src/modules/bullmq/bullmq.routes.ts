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
} from "./bullmq.schema";
import { sseAuth } from "../../middleware/sseAuth.middleware";

const router = Router({ mergeParams: true });

// router.use(authenticate);

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
    "/:queueName/stream",
    sseAuth,
    validate(streamQueueStatsSchema),
    BullMQController.streamQueueStats,
);

export default router;
