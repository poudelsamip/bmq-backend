import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import * as ProjectController from "./project.controller";
import { validate } from "../../middleware/validate.middleware";
import {
    createProjectSchema,
    projectParamsSchema,
    updateProjectSchema,
} from "./project.schema";

const router = Router();

router.post(
    "/",
    authenticate,
    validate(createProjectSchema),
    ProjectController.createProject,
);

router.get("/", authenticate, ProjectController.getProjects);

router.get(
    "/:id",
    authenticate,
    validate(projectParamsSchema),
    ProjectController.getProject,
);

router.get(
    "/:id/stats",
    authenticate,
    validate(projectParamsSchema),
    ProjectController.getProjectStats,
);

router.put(
    "/:id",
    authenticate,
    validate(updateProjectSchema),
    ProjectController.updateProject,
);

router.delete(
    "/:id",
    authenticate,
    validate(projectParamsSchema),
    ProjectController.deleteProject,
);

export default router;
