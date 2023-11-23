// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable camelcase, no-console */

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
    } catch (err) {
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

function onDialogSubmit(req, res) {
    const {body} = req;

    res.setHeader('Content-Type', 'application/json');

    let message;
    if (body.cancelled) {
        message = 'Dialog cancelled';
        sendSysadminResponse(message, body.channel_id);
    } else {
        message = 'Dialog submitted';
        sendSysadminResponse(message, body.channel_id);
    }

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
