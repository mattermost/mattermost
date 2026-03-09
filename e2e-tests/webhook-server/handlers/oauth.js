// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const { sendText, sendJSON, redirect } = require("../lib/router");

function oauthCredentials({ body, context, res }) {
    const { appID, appSecret } = body;

    context.oauthClient = {
        clientId: appID,
        clientSecret: appSecret,
        authorizationUri: `${context.baseUrl}/oauth/authorize`,
        accessTokenUri: `${context.baseUrl}/oauth/access_token`,
        // Must use underscore form to match the callback URL registered in Mattermost by the test.
        // The router normalizes /complete_oauth -> /complete-oauth for incoming requests.
        redirectUri: `${context.webhookBaseUrl}/complete_oauth`,
    };

    sendText(res, 200, "OK");
}

function oauthStart({ context, res }) {
    const { clientId, authorizationUri, redirectUri } = context.oauthClient;
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
    });

    redirect(res, `${authorizationUri}?${params}`);
}

async function oauthComplete({ req, context, res }) {
    const { clientId, clientSecret, accessTokenUri, redirectUri } = context.oauthClient;

    // Extract authorization code from the callback URL
    const callbackUrl = new URL(req.url, `http://${req.headers.host}`);
    const code = callbackUrl.searchParams.get("code");

    try {
        const tokenRes = await fetch(accessTokenUri, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenRes.ok) {
            sendJSON(res, tokenRes.status, { error: "Token exchange failed" });
            return;
        }

        const tokenData = await tokenRes.json();
        context.authedUser = {
            accessToken: tokenData.access_token,
        };

        sendText(res, 200, "OK");
    } catch (err) {
        console.error("OAuth complete error:", err.message);
        sendJSON(res, 500, { error: err.message });
    }
}

async function oauthMessage({ body, context, res }) {
    const { channelId, message, rootId, createAt } = body;
    const apiUrl = `${context.baseUrl}/api/v4/posts`;

    try {
        await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                Authorization: `Bearer ${context.authedUser.accessToken}`,
            },
            body: JSON.stringify({
                channel_id: channelId,
                message,
                type: "",
                create_at: createAt,
                root_id: rootId,
            }),
        });
    } catch {
        // Do nothing — matches original behavior
    }

    sendText(res, 200, "OK");
}

module.exports = { oauthCredentials, oauthStart, oauthComplete, oauthMessage };
