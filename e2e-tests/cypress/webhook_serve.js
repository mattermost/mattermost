// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

const express = require('express');
const axios = require('axios');
const ClientOAuth2 = require('client-oauth2');

const webhookUtils = require('./utils/webhook_utils');
const postMessageAs = require('./tests/plugins/post_message_as');

const port = 3000;

const server = express();
server.use(express.json());
server.use(express.urlencoded({extended: true}));

process.title = process.argv[2];

server.get('/', ping);
server.post('/setup', doSetup);
server.post('/message_menus', postMessageMenus);
server.post('/dialog_request', onDialogRequest);
server.post('/simple_dialog_request', onSimpleDialogRequest);
server.post('/user_and_channel_dialog_request', onUserAndChannelDialogRequest);
server.post('/dialog_submit', onDialogSubmit);
server.post('/boolean_dialog_request', onBooleanDialogRequest);
server.post('/multiselect_dialog_request', onMultiSelectDialogRequest);
server.post('/dynamic_select_dialog_request', onDynamicSelectDialogRequest);
server.post('/dynamic_select_source', onDynamicSelectSource);
server.post('/dialog/field-refresh', onFieldRefreshDialogRequest);
server.post('/dialog/multistep', onMultistepDialogRequest);
server.post('/field_refresh_source', onFieldRefreshSource);
server.post('/datetime_dialog_request', onDateTimeDialogRequest);
server.post('/datetime_dialog_submit', onDateTimeDialogSubmit);
server.post('/slack_compatible_message_response', postSlackCompatibleMessageResponse);
server.post('/send_message_to_channel', postSendMessageToChannel);
server.post('/post_outgoing_webhook', postOutgoingWebhook);
server.post('/send_oauth_credentials', postSendOauthCredentials);
server.get('/start_oauth', getStartOAuth);
server.get('/complete_oauth', getCompleteOauth);
server.post('/post_oauth_message', postOAuthMessage);

server.listen(port, () => console.log(`Webhook test server listening on port ${port}!`));

function ping(req, res) {
    return res.json({
        message: 'I\'m alive!',
        endpoints: [
            'GET /',
            'POST /setup',
            'POST /message_menus',
            'POST /dialog_request',
            'POST /simple_dialog_request',
            'POST /user_and_channel_dialog_request',
            'POST /dialog_submit',
            'POST /boolean_dialog_request',
            'POST /multiselect_dialog_request',
            'POST /dynamic_select_dialog_request',
            'POST /dynamic_select_source',
            'POST /dialog/field-refresh',
            'POST /dialog/multistep',
            'POST /field_refresh_source',
            'POST /datetime_dialog_request',
            'POST /datetime_dialog_submit',
            'POST /slack_compatible_message_response',
            'POST /send_message_to_channel',
            'POST /post_outgoing_webhook',
            'POST /send_oauth_credentials',
            'GET /start_oauth',
            'GET /complete_oauth',
            'POST /post_oauth_message',
        ],
    });
}

// Set base URLs and credential to be accessible by any endpoint
let baseUrl;
let webhookBaseUrl;
let adminUsername;
let adminPassword;
function doSetup(req, res) {
    baseUrl = req.body.baseUrl;
    webhookBaseUrl = req.body.webhookBaseUrl;
    adminUsername = req.body.adminUsername;
    adminPassword = req.body.adminPassword;

    return res.status(201).send('Successfully setup the new base URLs and credential.');
}

let client;
let authedUser;
function postSendOauthCredentials(req, res) {
    const {
        appID,
        appSecret,
    } = req.body;
    client = new ClientOAuth2({
        clientId: appID,
        clientSecret: appSecret,
        authorizationUri: `${baseUrl}/oauth/authorize`,
        accessTokenUri: `${baseUrl}/oauth/access_token`,
        redirectUri: `${webhookBaseUrl}/complete_oauth`,
    });
    return res.status(200).send('OK');
}

function getStartOAuth(req, res) {
    return res.redirect(client.code.getUri());
}

function getCompleteOauth(req, res) {
    client.code.getToken(req.originalUrl).then((user) => {
        authedUser = user;
        return res.status(200).send('OK');
    }).catch((reason) => {
        return res.status(reason.status).send(reason);
    });
}

async function postOAuthMessage(req, res) {
    const {channelId, message, rootId, createAt} = req.body;
    const apiUrl = `${baseUrl}/api/v4/posts`;
    authedUser.sign({
        method: 'post',
        url: apiUrl,
    });
    try {
        await axios({
            url: apiUrl,
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                Authorization: 'Bearer ' + authedUser.accessToken,
            },
            method: 'post',
            data: {
                channel_id: channelId,
                message,
                type: '',
                create_at: createAt,
                root_id: rootId,
            },
        });
    } catch {
        // Do nothing
    }
    return res.status(200).send('OK');
}

function postSlackCompatibleMessageResponse(req, res) {
    const {spoiler, skipSlackParsing} = req.body.context;

    res.setHeader('Content-Type', 'application/json');
    return res.json({
        ephemeral_text: spoiler,
        skip_slack_parsing: skipSlackParsing,
    });
}

function postMessageMenus(req, res) {
    let responseData = {};
    const {body} = req;
    if (body && body.context.action === 'do_something') {
        responseData = {
            ephemeral_text: `Ephemeral | ${body.type} ${body.data_source} option: ${body.context.selected_option}`,
        };
    }

    res.setHeader('Content-Type', 'application/json');
    return res.json(responseData);
}

async function openDialog(dialog) {
    await axios({
        method: 'post',
        url: `${baseUrl}/api/v4/actions/dialogs/open`,
        data: dialog,
    });
}

function onDialogRequest(req, res) {
    const {body} = req;
    if (body.trigger_id) {
        const dialog = webhookUtils.getFullDialog(body.trigger_id, webhookBaseUrl);
        openDialog(dialog);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.json({text: 'Full dialog triggered via slash command!'});
}

function onSimpleDialogRequest(req, res) {
    const {body} = req;
    if (body.trigger_id) {
        const dialog = webhookUtils.getSimpleDialog(body.trigger_id, webhookBaseUrl);
        openDialog(dialog);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.json({text: 'Simple dialog triggered via slash command!'});
}

function onUserAndChannelDialogRequest(req, res) {
    const {body} = req;
    if (body.trigger_id) {
        const dialog = webhookUtils.getUserAndChannelDialog(body.trigger_id, webhookBaseUrl);
        openDialog(dialog);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.json({text: 'Simple dialog triggered via slash command!'});
}

function onBooleanDialogRequest(req, res) {
    const {body} = req;
    if (body.trigger_id) {
        const dialog = webhookUtils.getBooleanDialog(body.trigger_id, webhookBaseUrl);
        openDialog(dialog);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.json({text: 'Simple dialog triggered via slash command!'});
}

function onMultiSelectDialogRequest(req, res) {
    const {body} = req;
    if (body.trigger_id) {
        // Check URL parameters or body for includeDefaults flag
        const includeDefaults = req.query.includeDefaults === 'true' || req.query.includeDefaults === true;
        const dialog = webhookUtils.getMultiSelectDialog(body.trigger_id, webhookBaseUrl, includeDefaults);
        openDialog(dialog);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.json({text: 'Multiselect dialog triggered via slash command!'});
}

function onDynamicSelectDialogRequest(req, res) {
    const {body} = req;
    if (body.trigger_id) {
        const dialog = webhookUtils.getDynamicSelectDialog(body.trigger_id, webhookBaseUrl);
        openDialog(dialog);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.json({text: 'Dynamic select dialog triggered via slash command!'});
}

function onDynamicSelectSource(req, res) {
    const {body} = req;

    // Simulate dynamic options based on search text
    const searchText = (body.submission.query || '').toLowerCase();

    const allOptions = [
        {text: 'Backend Engineer', value: 'backend_eng'},
        {text: 'Frontend Engineer', value: 'frontend_eng'},
        {text: 'Full Stack Engineer', value: 'fullstack_eng'},
        {text: 'DevOps Engineer', value: 'devops_eng'},
        {text: 'QA Engineer', value: 'qa_eng'},
        {text: 'Product Manager', value: 'product_mgr'},
        {text: 'Engineering Manager', value: 'eng_mgr'},
        {text: 'Senior Backend Engineer', value: 'sr_backend_eng'},
        {text: 'Senior Frontend Engineer', value: 'sr_frontend_eng'},
        {text: 'Principal Engineer', value: 'principal_eng'},
        {text: 'Staff Engineer', value: 'staff_eng'},
        {text: 'Technical Lead', value: 'tech_lead'},
    ];

    // Filter options based on search text
    const filteredOptions = searchText ?
        allOptions.filter((option) =>
            option.text.toLowerCase().includes(searchText) ||
            option.value.toLowerCase().includes(searchText)) :
        allOptions.slice(0, 6); // Limit to first 6 if no search

    res.setHeader('Content-Type', 'application/json');
    return res.json({
        items: filteredOptions,
    });
}

function onDateTimeDialogRequest(req, res) {
    const {body} = req;
    if (body.trigger_id) {
        let dialog;
        const command = body.text ? body.text.trim() : '';

        // Use focused dialog functions based on command parameter
        switch (command) {
        case 'basic':
            dialog = webhookUtils.getBasicDateDialog(body.trigger_id, webhookBaseUrl);
            break;
        case 'mindate':
            dialog = webhookUtils.getMinDateConstraintDialog(body.trigger_id, webhookBaseUrl);
            break;
        case 'interval':
            dialog = webhookUtils.getCustomIntervalDialog(body.trigger_id, webhookBaseUrl);
            break;
        case 'relative':
            dialog = webhookUtils.getRelativeDateDialog(body.trigger_id, webhookBaseUrl);
            break;
        default:
            // Default to basic datetime dialog for backward compatibility
            dialog = webhookUtils.getBasicDateTimeDialog(body.trigger_id, webhookBaseUrl);
            break;
        }
        console.log('Opening DateTime dialog', dialog.dialog.title);
        openDialog(dialog);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.json({text: 'DateTime dialog triggered via slash command!'});
}

function onDateTimeDialogSubmit(req, res) {
    console.log('DateTime dialog submit handler called!');
    const {body} = req;

    res.setHeader('Content-Type', 'application/json');

    // Log the submitted datetime values for debugging
    console.log('DateTime dialog submission:', JSON.stringify(body, null, 2));

    // Extract datetime values from submission
    const submission = body.submission || {};
    const eventDate = submission.event_date;
    const meetingTime = submission.meeting_time;
    const relativeDate = submission.relative_date;
    const relativeDateTime = submission.relative_datetime;

    // Create a success message with the submitted values
    let message = 'Form submitted successfully! ';
    if (eventDate || meetingTime || relativeDate || relativeDateTime) {
        message += 'Submitted values: ';
        if (eventDate) {
            message += `Event Date: ${eventDate}, `;
        }
        if (meetingTime) {
            message += `Meeting Time: ${meetingTime}, `;
        }
        if (relativeDate) {
            message += `Relative Date: ${relativeDate}, `;
        }
        if (relativeDateTime) {
            message += `Relative DateTime: ${relativeDateTime}, `;
        }
        message = message.slice(0, -2); // Remove trailing comma and space
    }

    // Send success response that will appear as a post in the channel
    sendSysadminResponse(message, body.channel_id);
    return res.json({text: message});
}

function onDialogSubmit(req, res) {
    const {body} = req;

    res.setHeader('Content-Type', 'application/json');

    let message;
    if (body.cancelled) {
        message = 'Dialog cancelled';
        sendSysadminResponse(message, body.channel_id);
        return res.json({text: message});
    }

    // Check if this is a multistep submission
    if (body.callback_id === 'multistep_callback') {
        const currentState = body.state || '';

        // Determine next step based on current state
        if (currentState === 'step1') {
            // Move to step 2
            const nextForm = webhookUtils.getMultistepStep2Dialog(null, webhookBaseUrl);
            return res.json({
                type: 'form',
                form: nextForm,
            });
        } else if (currentState === 'step2') {
            // Move to step 3
            const nextForm = webhookUtils.getMultistepStep3Dialog(null, webhookBaseUrl);
            return res.json({
                type: 'form',
                form: nextForm,
            });
        }

        // Final step - complete the multistep
        const submission = body.submission || {};
        message = `Multistep completed successfully! Final step values: ${JSON.stringify(submission, null, 2)}`;
        sendSysadminResponse(message, body.channel_id);
        return res.json({text: message});
    }

    // Check if this is a field refresh dialog submission
    if (body.callback_id === 'field_refresh_callback') {
        const submission = body.submission || {};
        message = `Field refresh dialog submitted successfully! Values: ${JSON.stringify(submission, null, 2)}`;
        sendSysadminResponse(message, body.channel_id);
        return res.json({text: message});
    }

    // Regular dialog submission
    message = 'Dialog submitted';

    sendSysadminResponse(message, body.channel_id);
    return res.json({text: message});
}

/**
 * @route "POST /send_message_to_channel?type={messageType}&channel_id={channelId}"
 * @query type - message type of empty string for regular message if not provided (default), "system_message", etc
 * @query channel_id - channel where to send the message
 */
function postSendMessageToChannel(req, res) {
    const channelId = req.query.channel_id;
    const response = {
        response_type: 'in_channel',
        text: 'Extra response 2',
        channel_id: channelId,
        extra_responses: [{
            response_type: 'in_channel',
            text: 'Hello World',
            channel_id: channelId,
        }],
    };

    if (req.query.type) {
        response.type = req.query.type;
    }

    res.json(response);
}

// Convenient way to send response in a channel by using sysadmin account
function sendSysadminResponse(message, channelId) {
    postMessageAs({
        sender: {
            username: adminUsername,
            password: adminPassword,
        },
        message,
        channelId,
        baseUrl,
    });
}

const responseTypes = ['in_channel', 'comment'];

function getWebhookResponse(body, {responseType, username, iconUrl}) {
    const payload = Object.entries(body).map(([key, value]) => `- ${key}: "${value}"`).join('\n');

    return `
\`\`\`
#### Outgoing Webhook Payload
${payload}
#### Webhook override to Mattermost instance
- response_type: "${responseType}"
- type: ""
- username: "${username}"
- icon_url: "${iconUrl}"
\`\`\`
`;
}

/**
 * @route "POST /post_outgoing_webhook?override_username={username}&override_icon_url={iconUrl}&response_type={comment}"
 * @query override_username - the user name that overrides the user name defined by the outgoing webhook
 * @query override_icon_url - the user icon url that overrides the user icon url defined by the outgoing webhook
 * @query response_type - "in_channel" (default) or "comment"
 */
function postOutgoingWebhook(req, res) {
    const {body, query} = req;
    if (!body) {
        res.status(404).send({error: 'Invalid data'});
    }

    const responseType = query.response_type || responseTypes[0];
    const username = query.override_username || '';
    const iconUrl = query.override_icon_url || '';

    const response = {
        text: getWebhookResponse(body, {responseType, username, iconUrl}),
        username,
        icon_url: iconUrl,
        type: '',
        response_type: responseType,
    };
    res.status(200).send(response);
}

function onFieldRefreshDialogRequest(req, res) {
    const {body} = req;
    if (body.trigger_id) {
        const dialog = webhookUtils.getFieldRefreshDialog(body.trigger_id, webhookBaseUrl);
        openDialog(dialog);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.json({text: 'Field refresh dialog triggered via slash command!'});
}

function onMultistepDialogRequest(req, res) {
    const {body} = req;
    if (body.trigger_id) {
        const dialog = webhookUtils.getMultistepStep1Dialog(body.trigger_id, webhookBaseUrl);
        openDialog(dialog);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.json({text: 'Multistep dialog triggered via slash command!'});
}

function onFieldRefreshSource(req, res) {
    const {body} = req;
    const submission = body.submission || {};
    const projectType = submission.project_type;
    const projectName = submission.project_name || '';

    res.setHeader('Content-Type', 'application/json');

    // Return updated form based on project type selection
    const elements = [
        {
            display_name: 'Project Name',
            name: 'project_name',
            type: 'text',
            placeholder: 'Enter project name',
            default: projectName,
            optional: false,
        },
        {
            display_name: 'Project Type',
            name: 'project_type',
            type: 'select',
            refresh: true,
            placeholder: 'Select project type...',
            default: projectType,
            options: [
                {text: 'Web Application', value: 'web'},
                {text: 'Mobile App', value: 'mobile'},
                {text: 'API Service', value: 'api'},
            ],
        },
    ];

    // Add different fields based on project type
    if (projectType === 'web') {
        elements.push({
            display_name: 'Framework',
            name: 'framework',
            type: 'select',
            placeholder: 'Select framework...',
            options: [
                {text: 'React', value: 'react'},
                {text: 'Vue', value: 'vue'},
                {text: 'Angular', value: 'angular'},
            ],
        });
    } else if (projectType === 'mobile') {
        elements.push({
            display_name: 'Platform',
            name: 'platform',
            type: 'select',
            placeholder: 'Select platform...',
            options: [
                {text: 'iOS', value: 'ios'},
                {text: 'Android', value: 'android'},
                {text: 'React Native', value: 'react-native'},
            ],
        });
    } else if (projectType === 'api') {
        elements.push({
            display_name: 'Language',
            name: 'language',
            type: 'select',
            placeholder: 'Select language...',
            options: [
                {text: 'Go', value: 'go'},
                {text: 'Node.js', value: 'nodejs'},
                {text: 'Python', value: 'python'},
            ],
        });
    }

    return res.json({
        type: 'form',
        form: {
            title: 'Field Refresh Demo',
            introduction_text: 'Enter project name then select type to see different fields',
            submit_label: 'Submit',
            elements,
        },
    });
}
