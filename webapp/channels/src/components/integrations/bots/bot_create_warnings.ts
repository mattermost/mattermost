// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type BotCreateWarnings = {
    attributesFailed?: boolean;
    tokenFailed?: boolean;
    rolesFailed?: boolean;
};

export const BOT_CREATE_WARNINGS_PARAM = 'bot_warnings';

type BotCreateWarningToken = 'token' | 'roles' | 'attributes';

const WARNING_TOKENS: ReadonlyArray<readonly [BotCreateWarningToken, keyof BotCreateWarnings]> = [
    ['token', 'tokenFailed'],
    ['roles', 'rolesFailed'],
    ['attributes', 'attributesFailed'],
];

export function serializeBotCreateWarnings(warnings: BotCreateWarnings): string | undefined {
    const tokens = WARNING_TOKENS.filter(([, key]) => warnings[key]).map(([token]) => token);
    return tokens.length ? tokens.join(',') : undefined;
}

export function hasBotCreateWarnings(warnings?: BotCreateWarnings): warnings is BotCreateWarnings {
    return Boolean(warnings?.tokenFailed || warnings?.rolesFailed || warnings?.attributesFailed);
}

export function parseBotCreateWarnings(search: string): BotCreateWarnings | undefined {
    const tokens = new Set(
        new URLSearchParams(search).getAll(BOT_CREATE_WARNINGS_PARAM).
            flatMap((value) => value.split(',')).
            map((token) => token.trim()),
    );

    const warnings: BotCreateWarnings = {};
    for (const [token, key] of WARNING_TOKENS) {
        if (tokens.has(token)) {
            warnings[key] = true;
        }
    }

    return Object.keys(warnings).length ? warnings : undefined;
}

function getParamName(part: string): string {
    const name = part.split('=', 1)[0].replace(/\+/g, ' ');
    try {
        return decodeURIComponent(name);
    } catch {
        return name;
    }
}

export function removeBotCreateWarningsParam(search: string): string {
    const query = search.startsWith('?') ? search.slice(1) : search;
    const kept = query.split('&').filter((part) => part && getParamName(part) !== BOT_CREATE_WARNINGS_PARAM);
    return kept.length ? `?${kept.join('&')}` : '';
}
