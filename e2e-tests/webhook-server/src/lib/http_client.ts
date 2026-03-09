// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export async function openDialog(baseUrl: string, dialog: Record<string, any>): Promise<void> {
    await fetch(`${baseUrl}/api/v4/actions/dialogs/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dialog),
    });
}

interface PostAsAdminArgs {
    username: string;
    password: string;
    channelId: string;
    message: string;
    rootId?: string;
    createAt?: number;
}

export async function postAsAdmin(baseUrl: string, args: PostAsAdminArgs): Promise<void> {
    const { username, password, channelId, message, rootId, createAt = 0 } = args;

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
