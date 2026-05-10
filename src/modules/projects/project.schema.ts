import { z } from "zod";

export const createProjectSchema = z.object({
    body: z.object({
        name: z
            .string({ required_error: "Project name is required" })
            .trim()
            .min(1, "Project name cannot be empty")
            .max(50, "Project name can have max 50 characters"),

        redis_url: z
            .string({ required_error: "REDIS URL is required" })
            .trim()
            .min(1, "Redis URL cannot be empty")
            .refine(
                (url) =>
                    url.startsWith("redis://") || url.startsWith("rediss://"),
                {
                    message:
                        "Invalid Redis URL. Redis URL must start with redis:// or rediss://",
                },
            )
            .refine(
                (url) => {
                    try {
                        const parsed = new URL(url);
                        return parsed.hostname.length > 0;
                    } catch {
                        return false;
                    }
                },
                { message: "Redis URL must be a valid URL with a hostname" },
            ),

        description: z.string().trim().optional(),
    }),
});

export const updateProjectSchema = z.object({
    params: z.object({
        id: z
            .string({ required_error: "Project ID is required" })
            .uuid("Project ID must be a valid UUID"),
    }),
    body: z.object({
        name: z
            .string({ required_error: "Project name is required" })
            .trim()
            .min(1, "Project name cannot be empty")
            .max(50, "Project name can have max 50 characters")
            .optional(),
        description: z.string().trim().optional(),
    }),
});

export const projectParamsSchema = z.object({
    params: z.object({
        id: z
            .string({ required_error: "Project ID is required" })
            .uuid("Project ID must be a valid UUID"),
    }),
});

export type CreateProjectDto = z.infer<typeof createProjectSchema>["body"];
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>["body"];
export type ProjectParams = z.infer<typeof projectParamsSchema>["params"];
