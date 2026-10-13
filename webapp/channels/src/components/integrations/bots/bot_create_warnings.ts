// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type BotCreateWarnings = {
    tokenFailed?: boolean;
    imageFailed?: boolean;
    rolesFailed?: boolean;
    attributesFailed?: boolean;
};

// A query param rather than location.state: on desktop, getHistory().push forwards only the path.
export const BOT_CREATE_WARNINGS_PARAM = 'bot_warnings';

const WARNING_TOKENS: ReadonlyArray<readonly [string, keyof BotCreateWarnings]> = [
    ['token', 'tokenFailed'],
    ['image', 'imageFailed'],
    ['roles', 'rolesFailed'],
    ['attributes', 'attributesFailed'],
];

export function serializeBotCreateWarnings(warnings: BotCreateWarnings): string | undefined {
    const tokens = WARNING_TOKENS.filter(([, key]) => warnings[key]).map(([token]) => token);
    return tokens.length ? tokens.join(',') : undefined;
}

export function hasBotCreateWarnings(warnings?: BotCreateWarnings): warnings is BotCreateWarnings {
    return Boolean(warnings && WARNING_TOKENS.some(([, key]) => warnings[key]));
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

    return hasBotCreateWarnings(warnings) ? warnings : undefined;
}

/** Returns the search string without the warnings param, or undefined when it isn't present. */
export function stripBotCreateWarningsParam(search: string): string | undefined {
    const params = new URLSearchParams(search);
    if (!params.has(BOT_CREATE_WARNINGS_PARAM)) {
        return undefined;
    }
    params.delete(BOT_CREATE_WARNINGS_PARAM);
    const rest = params.toString();
    return rest ? `?${rest}` : '';
}
