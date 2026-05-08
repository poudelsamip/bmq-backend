import { z } from "zod";

const projectIdParam = z
    .string({ required_error: "Project ID is required" })
    .uuid("Project ID must be a valid UUID");

const queueNameParam = z
    .string({ required_error: "Queue name is required" })
    .trim()
    .min(1, "Queue name can not be empty");

export const getQueuesSchema = z.object({
    params: z.object({
        projectId: projectIdParam,
    }),
});

export const getQueueStatsSchema = z.object({
    params: z.object({
        projectId: projectIdParam,
        queueName: queueNameParam,
    }),
});

const jobStateEnum = z.enum(
    ["all", "waiting", "active", "completed", "failed", "delayed"],
    {
        errorMap: () => ({
            message:
                "state must be one of: all, waiting, active, completed, failed, delayed.",
        }),
    },
);

export const getJobsSchema = z.object({
    params: z.object({
        projectId: projectIdParam,
        queueName: queueNameParam,
    }),
    query: z.object({
        state: jobStateEnum.default("all"),
        page: z.coerce
            .number({ invalid_type_error: "page must be a number" })
            .int("page must be an integer")
            .min(0, "page must be 0 or greater")
            .default(0),
        pageSize: z.coerce
            .number({ invalid_type_error: "pageSize must be a number." })
            .int("pageSize must be an integer.")
            .min(1, "pageSize must be at least 1.")
            .max(100, "pageSize cannot exceed 100.")
            .default(50),
    }),
});

export const getJobDetailsSchema = z.object({
    params: z.object({
        projectId: projectIdParam,
        queueName: queueNameParam,
        jobId: z
            .string({ required_error: "Job ID is required." })
            .trim()
            .min(1, "Job ID cannot be empty."),
    }),
});

export const retryJobSchema = z.object({
    params: z.object({
        projectId: projectIdParam,
        queueName: queueNameParam,

        jobId: z
            .string({ required_error: "Job ID is required." })
            .trim()
            .min(1, "Job ID cannot be empty."),
    }),
});

// SSE stream
export const streamQueueStatsSchema = z.object({
    params: z.object({
        projectId: projectIdParam,
        queueName: queueNameParam,
    }),
});

export const getFlowTreeSchema = z.object({
    params: z.object({
        projectId: projectIdParam,
        queueName: queueNameParam,
        jobId: z
            .string({ required_error: "Job ID is required." })
            .trim()
            .min(1, "Job ID cannot be empty."),
    }),
});

export type ListQueuesParams = z.infer<typeof getQueuesSchema>["params"];
export type GetQueueStatsParams = z.infer<typeof getQueueStatsSchema>["params"];
export type GetJobsParams = z.infer<typeof getJobsSchema>["params"];
export type GetJobsQuery = z.infer<typeof getJobsSchema>["query"];
export type GetJobDetailsParams = z.infer<typeof getJobDetailsSchema>["params"];
export type RetryJobParams = z.infer<typeof retryJobSchema>["params"];
export type StreamQueueParams = z.infer<
    typeof streamQueueStatsSchema
>["params"];
export type GetFlowTreeParams = z.infer<typeof getFlowTreeSchema>["params"];
