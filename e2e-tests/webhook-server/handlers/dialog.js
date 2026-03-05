// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const { sendJSON } = require("../lib/router");
const { openDialog, postAsAdmin } = require("../lib/http_client");
const dialogs = require("../config/dialogs.json");

function buildDialog(triggerId, webhookBaseUrl, config) {
    const submitUrlPath = config._submit_url_path || "/dialog-submit";

    const dialog = {
        trigger_id: triggerId,
        url: `${webhookBaseUrl}${submitUrlPath}`,
        dialog: {
            callback_id: config.callback_id,
            title: config.title,
            submit_label: config.submit_label || "Submit",
            notify_on_cancel: true,
            elements: config.elements || [],
        },
    };

    if (config.icon_url) {
        dialog.dialog.icon_url = config.icon_url;
    }
    if (config.introduction_text) {
        dialog.dialog.introduction_text = config.introduction_text;
    }
    if (config.state) {
        dialog.dialog.state = config.state;
    }
    if (config._source_url_path) {
        dialog.dialog.source_url = `${webhookBaseUrl}${config._source_url_path}`;
    }

    // Resolve dynamic data_source_url references in elements
    if (dialog.dialog.elements) {
        dialog.dialog.elements = dialog.dialog.elements.map((el) => {
            if (el._data_source_url_path) {
                const resolved = {
                    ...el,
                    data_source_url: `${webhookBaseUrl}${el._data_source_url_path}`,
                };
                delete resolved._data_source_url_path;
                return resolved;
            }
            return el;
        });
    }

    return dialog;
}

function buildFormResponse(webhookBaseUrl, config) {
    return {
        callback_id: config.callback_id,
        title: config.title,
        submit_label: config.submit_label || "Submit",
        notify_on_cancel: true,
        elements: config.elements || [],
        url: `${webhookBaseUrl}/dialog-submit`,
        state: config.state,
    };
}

function onOpenDialog({ body, query, context, res, meta }) {
    const dialogName = meta.dialog;
    const config = dialogs[dialogName];

    if (!config) {
        sendJSON(res, 400, { error: `Unknown dialog: ${dialogName}` });
        return;
    }

    if (body.trigger_id) {
        // Handle multiselect includeDefaults variant
        let dialogConfig = config;
        if (
            dialogName === "multiselect" &&
            (query.includeDefaults === "true" || query.includeDefaults === true)
        ) {
            dialogConfig = applyMultiselectDefaults(config);
        }

        const dialog = buildDialog(body.trigger_id, context.webhookBaseUrl, dialogConfig);
        openDialog(context.baseUrl, dialog);
    }

    sendJSON(res, 200, { text: `${config.title} triggered via slash command!` });
}

function applyMultiselectDefaults(config) {
    const defaults = config.include_defaults_variant;
    if (!defaults) {
        return config;
    }

    return {
        ...config,
        elements: config.elements.map((el) => {
            if (defaults[el.name] !== undefined) {
                return { ...el, default: defaults[el.name] };
            }
            return el;
        }),
    };
}

function onDialogSubmit({ body, context, res }) {
    let message;

    if (body.cancelled) {
        message = "Dialog cancelled";
        sendSysadminResponse(context, message, body.channel_id);
        sendJSON(res, 200, { text: message });
        return;
    }

    // Multistep dialog navigation
    if (body.callback_id === "multistep_callback") {
        const currentState = body.state || "";

        if (currentState === "step1") {
            const form = buildFormResponse(context.webhookBaseUrl, dialogs.multistepStep2);
            sendJSON(res, 200, { type: "form", form });
            return;
        }
        if (currentState === "step2") {
            const form = buildFormResponse(context.webhookBaseUrl, dialogs.multistepStep3);
            sendJSON(res, 200, { type: "form", form });
            return;
        }

        const submission = body.submission || {};
        message = `Multistep completed successfully! Final step values: ${JSON.stringify(submission, null, 2)}`;
        sendSysadminResponse(context, message, body.channel_id);
        sendJSON(res, 200, { text: message });
        return;
    }

    // Field refresh dialog submission
    if (body.callback_id === "field_refresh_callback") {
        const submission = body.submission || {};
        message = `Field refresh dialog submitted successfully! Values: ${JSON.stringify(submission, null, 2)}`;
        sendSysadminResponse(context, message, body.channel_id);
        sendJSON(res, 200, { text: message });
        return;
    }

    // Regular dialog submission
    message = "Dialog submitted";
    sendSysadminResponse(context, message, body.channel_id);
    sendJSON(res, 200, { text: message });
}

const DATETIME_SUBCOMMAND_MAP = {
    basic: "basicDate",
    mindate: "minDateConstraint",
    interval: "customInterval",
    relative: "relativeDate",
    "timezone-manual": "timezoneManual",
};

function onDatetimeDialogRequest({ body, context, res }) {
    if (body.trigger_id) {
        const command = body.text ? body.text.trim() : "";
        const dialogName = DATETIME_SUBCOMMAND_MAP[command] || "basicDateTime";
        const config = dialogs[dialogName];

        if (config) {
            const dialog = buildDialog(body.trigger_id, context.webhookBaseUrl, config);
            console.log("Opening DateTime dialog", dialog.dialog.title);
            openDialog(context.baseUrl, dialog);
        }
    }

    sendJSON(res, 200, { text: "DateTime dialog triggered via slash command!" });
}

function onDatetimeDialogSubmit({ body, context, res }) {
    console.log("DateTime dialog submit handler called!");
    console.log("DateTime dialog submission:", JSON.stringify(body, null, 2));

    const submission = body.submission || {};
    const {
        event_date: eventDate,
        meeting_time: meetingTime,
        relative_date: relativeDate,
        relative_datetime: relativeDateTime,
    } = submission;

    let message = "Form submitted successfully! ";
    if (eventDate || meetingTime || relativeDate || relativeDateTime) {
        const parts = [];
        if (eventDate) {
            parts.push(`Event Date: ${eventDate}`);
        }
        if (meetingTime) {
            parts.push(`Meeting Time: ${meetingTime}`);
        }
        if (relativeDate) {
            parts.push(`Relative Date: ${relativeDate}`);
        }
        if (relativeDateTime) {
            parts.push(`Relative DateTime: ${relativeDateTime}`);
        }
        message += "Submitted values: " + parts.join(", ");
    }

    sendSysadminResponse(context, message, body.channel_id);
    sendJSON(res, 200, { text: message });
}

const DYNAMIC_SELECT_OPTIONS = [
    { text: "Backend Engineer", value: "backend_eng" },
    { text: "Frontend Engineer", value: "frontend_eng" },
    { text: "Full Stack Engineer", value: "fullstack_eng" },
    { text: "DevOps Engineer", value: "devops_eng" },
    { text: "QA Engineer", value: "qa_eng" },
    { text: "Product Manager", value: "product_mgr" },
    { text: "Engineering Manager", value: "eng_mgr" },
    { text: "Senior Backend Engineer", value: "sr_backend_eng" },
    { text: "Senior Frontend Engineer", value: "sr_frontend_eng" },
    { text: "Principal Engineer", value: "principal_eng" },
    { text: "Staff Engineer", value: "staff_eng" },
    { text: "Technical Lead", value: "tech_lead" },
];

function onDynamicSelectSource({ body, res }) {
    const searchText = (body.submission?.query || "").toLowerCase();

    const filteredOptions = searchText
        ? DYNAMIC_SELECT_OPTIONS.filter(
              (opt) =>
                  opt.text.toLowerCase().includes(searchText) ||
                  opt.value.toLowerCase().includes(searchText),
          )
        : DYNAMIC_SELECT_OPTIONS.slice(0, 6);

    sendJSON(res, 200, { items: filteredOptions });
}

function onFieldRefreshSource({ body, res }) {
    const submission = body.submission || {};
    const projectType = submission.project_type;
    const projectName = submission.project_name || "";

    const elements = [
        {
            display_name: "Project Name",
            name: "project_name",
            type: "text",
            placeholder: "Enter project name",
            default: projectName,
            optional: false,
        },
        {
            display_name: "Project Type",
            name: "project_type",
            type: "select",
            refresh: true,
            placeholder: "Select project type...",
            default: projectType,
            options: [
                { text: "Web Application", value: "web" },
                { text: "Mobile App", value: "mobile" },
                { text: "API Service", value: "api" },
            ],
        },
    ];

    const typeFields = {
        web: {
            display_name: "Framework",
            name: "framework",
            options: [
                { text: "React", value: "react" },
                { text: "Vue", value: "vue" },
                { text: "Angular", value: "angular" },
            ],
        },
        mobile: {
            display_name: "Platform",
            name: "platform",
            options: [
                { text: "iOS", value: "ios" },
                { text: "Android", value: "android" },
                { text: "React Native", value: "react-native" },
            ],
        },
        api: {
            display_name: "Language",
            name: "language",
            options: [
                { text: "Go", value: "go" },
                { text: "Node.js", value: "nodejs" },
                { text: "Python", value: "python" },
            ],
        },
    };

    if (typeFields[projectType]) {
        const field = typeFields[projectType];
        elements.push({
            display_name: field.display_name,
            name: field.name,
            type: "select",
            placeholder: `Select ${field.name}...`,
            options: field.options,
        });
    }

    sendJSON(res, 200, {
        type: "form",
        form: {
            title: "Field Refresh Demo",
            introduction_text: "Enter project name then select type to see different fields",
            submit_label: "Submit",
            elements,
        },
    });
}

function sendSysadminResponse(context, message, channelId) {
    if (!context.baseUrl) {
        console.warn("sendSysadminResponse: baseUrl not set. Call /setup first.");
        return;
    }
    postAsAdmin(context.baseUrl, {
        username: context.adminUsername,
        password: context.adminPassword,
        channelId,
        message,
    });
}

module.exports = {
    onOpenDialog,
    onDialogSubmit,
    onDatetimeDialogRequest,
    onDatetimeDialogSubmit,
    onDynamicSelectSource,
    onFieldRefreshSource,
};
