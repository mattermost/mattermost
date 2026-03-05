// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

async function openDialog(baseUrl, dialog) {
    await fetch(`${baseUrl}/api/v4/actions/dialogs/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dialog),
    });
}

async function postAsAdmin(
    baseUrl,
    { username, password, channelId, message, rootId, createAt = 0 },
) {
    const loginRes = await fetch(`${baseUrl}/api/v4/users/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ login_id: username, password }),
    });
    const token = loginRes.headers.get("token");

    await fetch(`${baseUrl}/api/v4/posts`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            channel_id: channelId,
            message,
            type: "",
            create_at: createAt,
            root_id: rootId,
        }),
    });
}

module.exports = { openDialog, postAsAdmin };
