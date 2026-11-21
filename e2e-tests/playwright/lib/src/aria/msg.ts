// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IntlMessageFormat} from 'intl-messageformat';

/**
 * A message from the webapp's i18n catalog (generated into `Msg`). Tests never retype English: they format the message
 * the UI renders, with the same values.
 */
export type Message<P extends Record<string, unknown> = Record<string, never>> = {
    readonly id: string;
    readonly defaultMessage: string;

    /** Type-level only: the values the message takes. */
    readonly __params?: P;
};

export const msg = <P extends Record<string, unknown> = Record<string, never>>(
    id: string,
    defaultMessage: string,
): Message<P> => ({
    id,
    defaultMessage,
});

export type ParamsOf<M> = M extends Message<infer P> ? P : never;

const LOCALE = 'en-US';
const formats = new Map<string, IntlMessageFormat>();

/**
 * Formats a message in English (the catalog's default) as the webapp does, with ICU MessageFormat (`intl-messageformat`,
 * the library under react-intl). Rich-text tags (`<b>…</b>`) keep their text, and markdown emphasis the webapp renders
 * as markdown (`**joined the channel**`) is reduced to its text, so the result is what the element's text reads.
 */
export function formatMessage<M extends Message<any>>(m: M, values?: ParamsOf<M>): string {
    let format = formats.get(m.defaultMessage);
    if (!format) {
        format = new IntlMessageFormat(m.defaultMessage, LOCALE, undefined, {ignoreTag: true});
        formats.set(m.defaultMessage, format);
    }
    let text: string;
    try {
        text = String(
            format.format((values ?? {}) as Record<string, string | number | boolean | Date | null | undefined>),
        );
    } catch (e) {
        throw new Error(`formatMessage: ${m.id}: ${(e as Error).message}`);
    }
    return text
        .replace(/<\/?[a-zA-Z0-9_]+>/g, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1');
}
