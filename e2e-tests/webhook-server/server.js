// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const http = require("node:http");
const path = require("node:path");

const { createRouter } = require("./lib/router");
const { createContext } = require("./lib/context");

const { ping } = require("./handlers/ping");
const { setup } = require("./handlers/setup");
const {
    onOpenDialog,
    onDialogSubmit,
    onDatetimeDialogRequest,
    onDatetimeDialogSubmit,
    onDynamicSelectSource,
    onFieldRefreshSource,
} = require("./handlers/dialog");
const { messageMenu } = require("./handlers/message_menu");
const { slackCompatibleResponse, sendToChannel } = require("./handlers/message");
const { outgoingWebhookResponse } = require("./handlers/outgoing_webhook");
const { oauthCredentials, oauthStart, oauthComplete, oauthMessage } = require("./handlers/oauth");

// Type-to-handler mapping — the internal wiring that service consumers never see
const TYPE_HANDLERS = {
    ping: ping,
    setup: setup,
    "open-dialog": onOpenDialog,
    "dialog-submit": onDialogSubmit,
    "datetime-dialog-request": onDatetimeDialogRequest,
    "datetime-dialog-submit": onDatetimeDialogSubmit,
    "dynamic-select-source": onDynamicSelectSource,
    "field-refresh-source": onFieldRefreshSource,
    "message-menu": messageMenu,
    "slack-compatible-response": slackCompatibleResponse,
    "send-to-channel": sendToChannel,
    "outgoing-webhook-response": outgoingWebhookResponse,
    "oauth-credentials": oauthCredentials,
    "oauth-start": oauthStart,
    "oauth-complete": oauthComplete,
    "oauth-message": oauthMessage,
};

const PORT = process.env.WEBHOOK_PORT || 3000;

function loadServices(router, servicesConfig) {
    for (const service of servicesConfig.services) {
        const handler = TYPE_HANDLERS[service.type];
        if (!handler) {
            console.warn(`Unknown service type: ${service.type} for path ${service.path}`);
            continue;
        }

        const meta = {
            description: service.description,
            type: service.type,
            dialog: service.dialog,
        };

        const method = service.method.toLowerCase();
        if (method === "get") {
            router.get(service.path, handler, meta);
        } else if (method === "post") {
            router.post(service.path, handler, meta);
        }
    }
}

function start() {
    const router = createRouter();
    const context = createContext();

    // Load service catalog
    const servicesConfig = require(path.join(__dirname, "config", "services.json"));
    loadServices(router, servicesConfig);

    // Inject listServices into ping handler's meta
    const pingMeta = {
        description: "Health check. Returns server status and full service catalog.",
        type: "ping",
        listServices: () => router.listServices(),
    };
    router.get("/", ping, pingMeta);

    // Set process title if provided (for Docker compatibility)
    if (process.argv[2]) {
        process.title = process.argv[2];
    }

    const server = http.createServer((req, res) => {
        router.handle(req, res, context);
    });

    server.listen(PORT, () => {
        console.log(`Webhook test server listening on port ${PORT}!`);
    });

    return server;
}

start();
