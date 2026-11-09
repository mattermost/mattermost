// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

type PendingBotToken = {
    botUserId: string;
    token: string;
};

let pending: PendingBotToken | undefined;

export function setPendingBotToken(botUserId: string, token: string): void {
    pending = {botUserId, token};
}

export function takePendingBotToken(botUserId: string): string | undefined {
    if (!pending || pending.botUserId !== botUserId) {
        return undefined;
    }
    const {token} = pending;
    pending = undefined;
    return token;
}
