import { Job, Queue } from "bullmq";
import IORedis from "ioredis";
import { getCachedQueue } from "./connection.cache";

// BullMQ stores data in Redis using this key pattern:
//      bull:{queueName}:meta       — metadata about the queue
//      bull:{queueName}:waiting    — list of waiting job IDs
//      bull:{queueName}:active     — list of active job IDs
//      bull:{queueName}:failed     — sorted set of failed job IDs
//      bull:{queueName}:completed  — sorted set of completed job IDs
//      bull:{queueName}:1          — hash containing full job data

export const findQueues = async (redisUrl: string) => {
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

export const getQueueStats = async (
    projectId: string,
    queueName: string,
    redisUrl: string,
) => {
    const queue = getCachedQueue(projectId, queueName, redisUrl);

    const counts = await queue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
        "paused",
    );

    return { queueName, counts };
};

export type JobState =
    | "waiting"
    | "active"
    | "completed"
    | "failed"
    | "delayed";

export const getJobs = async (
    projectId: string,
    queueName: string,
    redisUrl: string,
    state: JobState,
    page: number = 0,
    pageSize = 50,
) => {
    const queue = getCachedQueue(projectId, queueName, redisUrl);

    const start = page * pageSize;
    const end = start + pageSize - 1;

    const jobs = await queue.getJobs([state], start, end);

    return jobs.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        returnValue: job.returnvalue,
        failedReason: job.failedReason,
        stackTrace: job.stacktrace,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        parent: job.parent,
    }));
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
    const queue = getCachedQueue(projectId, queueName, redisUrl);

    const rootJob = await queue.getJob(rootJobId);
    if (!rootJob) {
        throw new Error("Root job not found");
    }

    const tree = await buildNode(rootJob, queueName);

    return tree;
};

//CLAUDE
/*
export async function buildFlowTree(
    projectId: string,
    redisUrl: string,
    queueNames: string[]
) {
    // Step 1 — collect all failed jobs from all queues.
    // We focus on failed jobs because that's when the tree view is most useful —
    // seeing which part of a multi-step flow broke.
    const allJobs: any[] = [];
 
    for (const queueName of queueNames) {
        const jobs = await getJobs(projectId, queueName, redisUrl, "failed", 0, 200);
        // Tag each job with its queue name so the UI knows where it lives
        allJobs.push(...jobs.map((j) => ({ ...j, queueName })));
    }
 
    // Step 2 — build a Map of jobId → job for O(1) parent lookups.
    // Without this, finding a parent would require scanning the array every time.
    const jobMap = new Map(allJobs.map((job) => [job.id, job]));
 
    // Step 3 — group children under their parent ID.
    // childrenMap: parentId → [child, child, ...]
    const childrenMap = new Map<string, any[]>();
    const roots: any[] = [];
 
    for (const job of allJobs) {
        if (job.parent?.id) {
            // This job has a parent — add it to the parent's children list
            if (!childrenMap.has(job.parent.id)) {
                childrenMap.set(job.parent.id, []);
            }
            childrenMap.get(job.parent.id)!.push(job);
        } else {
            // No parent = this is a root node of a flow
            roots.push(job);
        }
    }
 
    // Step 4 — recursively build the tree structure.
    // buildNode calls itself for each child, which calls itself for each
    // grandchild, and so on — until we reach leaves (jobs with no children).
    function buildNode(job: any): any {
        return {
            id: job.id,
            name: job.name,
            queueName: job.queueName,
            failedReason: job.failedReason,
            attemptsMade: job.attemptsMade,
            timestamp: job.timestamp,
            // Recursively attach children — empty array if this is a leaf node
            children: (childrenMap.get(job.id) ?? []).map(buildNode),
        };
    }
 
    // Build from all roots — returns an array of trees
    // Each tree represents one top-level flow that had failures somewhere
    return roots.map(buildNode);
}
 */
