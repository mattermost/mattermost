// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import { resolve } from "node:path";

import express from "express";

import { createContext } from "./lib/context";
import type { Handler, HandlerArgs, ServiceMeta } from "./lib/types";

import { ping } from "./handlers/ping";
import { setup } from "./handlers/setup";
import { messageMenu } from "./handlers/message_menu";
import { slackCompatibleResponse, messageInChannel } from "./handlers/message";
import { outgoingWebhookResponse } from "./handlers/outgoing";
import {
    register,
    dynamicMiddleware,
    listDynamicRoutes,
    loadStaticDialogs,
} from "./handlers/dynamic";

const PORT = process.env.WEBHOOK_PORT || 3000;

function start() {
    const app = express();
    const context = createContext();

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Load static dialogs from config/dialogs.json (read-only, cannot be overwritten by tests)
    const dialogsPath = resolve(process.cwd(), "config", "dialogs.json");
    loadStaticDialogs(dialogsPath);

    // Backward compatibility: normalize underscores to hyphens for legacy Cypress paths
    app.use((req, _res, next) => {
        if (req.path.includes("_")) {
            req.url = req.url.replace(/^([^?]*)/, (match) => match.replace(/_/g, "-"));
        }
        next();
    });

    // Dynamic routes — checked on every request via middleware.
    // Tests register endpoints at runtime via POST /register.
    app.use(dynamicMiddleware(context));

    // GET / — health check, returns dynamically registered routes
    app.get("/", (req, res) => {
        const args: HandlerArgs = {
            req,
            res,
            body: null,
            query: req.query as Record<string, string>,
            context,
            meta: {
                description: "Health check. Returns server status and registered routes.",
                type: "ping",
                listServices: () => listDynamicRoutes(),
            },
        };
        ping(args);
    });

    // POST /setup — internal, called by requireWebhookServer()
    app.post("/setup", (req, res) => {
        setup({
            req,
            res,
            body: req.body,
            query: req.query as Record<string, string>,
            context,
            meta: {},
        });
    });

    // POST /register — tests define endpoints at runtime
    const registerHandler = register(context);
    app.post("/register", (req, res) => {
        registerHandler({
            req,
            res,
            body: req.body,
            query: req.query as Record<string, string>,
            context,
            meta: {},
        });
    });

    // Static routes — hardcoded handlers
    const wrapHandler = (handler: Handler, meta: ServiceMeta = {}): express.RequestHandler => {
        return (req, res) =>
            handler({
                req,
                res,
                body: req.body ?? null,
                query: req.query as Record<string, string>,
                context,
                meta,
            });
    };
    app.post("/success", (_req, res) => res.status(200).json({ status: "ok" }));
    app.post("/message-menus", wrapHandler(messageMenu));
    app.post("/slack-compatible-response", wrapHandler(slackCompatibleResponse));
    app.post("/message-in-channel", wrapHandler(messageInChannel));
    app.post("/outgoing", wrapHandler(outgoingWebhookResponse));

    if (process.argv[2]) {
        process.title = process.argv[2];
    }

    app.listen(PORT, () => {
        console.log(`Webhook test server listening on port ${PORT}!`);
    });
}

start();
