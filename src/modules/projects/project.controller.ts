import { Request, Response, NextFunction } from "express";
import * as ProjectService from "./project.service";
import { CreateProjectDto, UpdateProjectDto } from "./project.schema";

export const createProject = async (
    req: Request<{}, {}, CreateProjectDto>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { id: userId, plan } = req.user!;

        const project = await ProjectService.createProject(
            userId,
            plan,
            req.body,
        );

        return res.status(201).json({
            success: true,
            message: "Project created successfully",
            data: project,
        });
    } catch (error) {
        next(error);
    }
};

export const getProjects = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const userId = req.user!.id;

        const projects = await ProjectService.getProjects(userId);

        return res.status(200).json({
            success: true,
            message: "All projects fetched successfully",
            data: projects,
        });
    } catch (error) {
        next(error);
    }
};

export const getProject = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const userId = req.user!.id;
        const projectId = req.params.id;

        const project = await ProjectService.getProjectDetails(projectId, userId);

        return res.status(200).json({
            success: true,
            message: "Project fetched successfully",
            data: project,
        });
    } catch (error) {
        next(error);
    }
};

export const updateProject = async (
    req: Request<{ id: string }, {}, UpdateProjectDto>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const userId = req.user!.id;
        const projectId = req.params.id;

        const updated = await ProjectService.updateProject(
            projectId,
            userId,
            req.body,
        );

        return res.status(200).json({
            success: true,
            message: "Project updated successfully",
            data: updated,
        });
    } catch (err) {
        next(err);
    }
};

export const getProjectStats = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const userId = req.user!.id;
        const projectId = req.params.id;

        const { redisUrl } = await ProjectService.getProjectWithRedisUrl(
            projectId,
            userId,
        );

        const stats = await ProjectService.getProjectStats(
            projectId,
            redisUrl,
        );

        return res.status(200).json({
            success: true,
            message: "Project stats fetched successfully",
            data: stats,
        });
    } catch (error) {
        next(error);
    }
};

export const deleteProject = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const userId = req.user!.id;
        const projectId = req.params.id;

        await ProjectService.deleteProject(projectId, userId);

        return res.status(200).json({
            success: true,
            message: "Project deleted successfully",
        });
    } catch (err) {
        next(err);
    }
};
