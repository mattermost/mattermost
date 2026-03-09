// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import { readFileSync } from "node:fs";

import type express from "express";

import { openDialog, postAsAdmin } from "../lib/http_client";
import type { DialogConfig, HandlerArgs, ServerContext } from "../lib/types";

/**
 * Registry of dynamically registered routes.
 * Key: "METHOD:path" (e.g., "POST:/dialog/my-test")
 */
const dynamicRoutes = new Map<string, DynamicRouteConfig>();

/**
 * Reserved paths loaded from dialogs.json at startup.
 * Tests cannot overwrite these — they must create new dialogs with unique names.
 */
const reservedPaths = new Set<string>();

export interface DynamicRouteConfig {
    type: "dialog" | "json-response" | "text-response";
    action?: "open" | "submit";
    dialog?: DialogConfig;
    response?: Record<string, any>;
    responseText?: string;
    statusCode?: number;
    description?: string;
}

/**
 * Loads static dialog templates from a JSON file and registers them
 * as read-only routes at POST /dialog/<name>.
 */
export function loadStaticDialogs(configPath: string): void {
    try {
        const raw = readFileSync(configPath, "utf-8");
        const dialogs = JSON.parse(raw) as Record<string, DialogConfig>;

        for (const [name, dialog] of Object.entries(dialogs)) {
            const path = `/dialog/${name}`;
            const key = `POST:${path}`;

            dynamicRoutes.set(key, {
                type: "dialog",
                action: "open",
                dialog,
                description: `Static dialog: ${dialog.title}`,
            });

            reservedPaths.add(path);
        }

        console.log(`Loaded ${reservedPaths.size} static dialogs from config/dialogs.json`);
    } catch {
        console.log("No config/dialogs.json found — starting with dynamic-only routes");
    }

    // Always register the default dialog-submit handler
    const submitKey = "POST:/dialog-submit";
    if (!dynamicRoutes.has(submitKey)) {
        dynamicRoutes.set(submitKey, {
            type: "dialog",
            action: "submit",
            description: "Default dialog submit handler",
        });
        reservedPaths.add("/dialog-submit");
    }
}

/**
 * POST /register
 *
 * Register a dynamic route at runtime.
 * Throws 409 if the path collides with a static dialog from dialogs.json.
 */
export function register(_context: ServerContext) {
    return ({ body, res }: HandlerArgs): void => {
        if (!body?.path || !body?.type) {
            res.status(400).json({ error: "Missing required fields: path, type" });
            return;
        }

        const method = (body.method || "POST").toUpperCase();
        const path = body.path as string;

        // Block overwriting static dialogs
        if (reservedPaths.has(path)) {
            res.status(409).json({
                error: `Path "${path}" is a static dialog from dialogs.json and cannot be overwritten. Use a unique name instead.`,
            });
            return;
        }

        const key = `${method}:${path}`;

        const config: DynamicRouteConfig = {
            type: body.type,
            action: body.action,
            dialog: body.dialog,
            response: body.response,
            responseText: body.responseText,
            statusCode: body.statusCode || 200,
            description: body.description || `Dynamic ${body.type} route`,
        };

        dynamicRoutes.set(key, config);

        res.status(201).json({
            registered: true,
            path,
            method,
            type: config.type,
            action: config.action,
        });
    };
}

/**
 * Express middleware that handles all dynamic and static routes.
 */
export function dynamicMiddleware(context: ServerContext): express.RequestHandler {
    return (req, res, next) => {
        const key = `${req.method}:${req.path}`;
        const config = dynamicRoutes.get(key);

        if (!config) {
            next();
            return;
        }

        switch (config.type) {
            case "dialog":
                if (config.action === "open") {
                    handleDialogOpen(req, res, context, config);
                } else if (config.action === "submit") {
                    handleDialogSubmit(req, res, context);
                } else {
                    res.status(400).json({ error: `Unknown dialog action: ${config.action}` });
                }
                break;
            case "json-response":
                res.status(config.statusCode || 200).json(config.response || {});
                break;
            case "text-response":
                res.status(config.statusCode || 200).send(config.responseText || "OK");
                break;
            default:
                res.status(400).json({ error: `Unknown dynamic type: ${config.type}` });
        }
    };
}

/**
 * Returns all registered routes (static + dynamic) for the ping endpoint.
 */
export function listDynamicRoutes() {
    return [...dynamicRoutes.entries()].map(([key, config]) => {
        const colonIndex = key.indexOf(":");
        const path = key.slice(colonIndex + 1);
        return {
            method: key.slice(0, colonIndex),
            path,
            type: config.type,
            description: config.description || "",
            dynamic: !reservedPaths.has(path),
        };
    });
}

function handleDialogOpen(
    req: express.Request,
    res: express.Response,
    context: ServerContext,
    config: DynamicRouteConfig,
) {
    const body = req.body;

    if (!config.dialog) {
        res.status(400).json({ error: "No dialog config registered for this route" });
        return;
    }

    if (body?.trigger_id && context.webhookBaseUrl && context.baseUrl) {
        const submitUrlPath = config.dialog._submit_url_path || "/dialog-submit";
        const dialogPayload: Record<string, any> = {
            trigger_id: body.trigger_id,
            url: `${context.webhookBaseUrl}${submitUrlPath}`,
            dialog: {
                callback_id: config.dialog.callback_id,
                title: config.dialog.title,
                submit_label: config.dialog.submit_label || "Submit",
                notify_on_cancel: true,
                elements: config.dialog.elements || [],
            },
        };

        if (config.dialog.icon_url) dialogPayload.dialog.icon_url = config.dialog.icon_url;
        if (config.dialog.introduction_text)
            dialogPayload.dialog.introduction_text = config.dialog.introduction_text;
        if (config.dialog.state) dialogPayload.dialog.state = config.dialog.state;

        openDialog(context.baseUrl, dialogPayload);
    }

    res.json({ text: `${config.dialog.title} triggered via slash command!` });
}

function handleDialogSubmit(req: express.Request, res: express.Response, context: ServerContext) {
    const body = req.body;
    let message: string;

    if (body?.cancelled) {
        message = "Dialog cancelled";
    } else {
        const submission = body?.submission || {};
        const fields = Object.entries(submission);
        message =
            fields.length > 0
                ? `Dialog submitted! Values: ${fields.map(([k, v]) => `${k}: ${v}`).join(", ")}`
                : "Dialog submitted";
    }

    if (context.baseUrl && context.adminUsername && context.adminPassword && body?.channel_id) {
        postAsAdmin(context.baseUrl, {
            username: context.adminUsername,
            password: context.adminPassword,
            channelId: body.channel_id,
            message,
        });
    }

    res.json({ text: message });
}
