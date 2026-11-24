// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import type {PropertyField} from '@mattermost/types/properties';

// The server's `PropertyFieldValueTypeTextMaxLength`, which counts UTF-8 bytes
// of the trimmed value. An input's `maxLength` counts UTF-16 code units, so it
// lets through multibyte text the server refuses.
export const TEXT_VALUE_MAX_BYTES = 64;

const messages = defineMessages({
    invalidEmail: {
        id: 'post_attributes.text_value.invalid_email',
        defaultMessage: 'Enter a valid email address',
        description: 'Inline error under a post attribute text input whose attribute holds an email address, shown when the value typed is not one.',
    },
    uppercaseEmail: {
        id: 'post_attributes.text_value.uppercase_email',
        defaultMessage: 'Use lowercase letters only',
        description: 'Inline error under a post attribute text input whose attribute holds an email address, shown when the value typed contains uppercase letters, which are not accepted.',
    },
    invalidUrl: {
        id: 'post_attributes.text_value.invalid_url',
        defaultMessage: 'Enter a valid URL, such as https://example.com',
        description: 'Inline error under a post attribute text input whose attribute holds a URL, shown when the value typed is not a full URL.',
    },
});

function utf8ByteLength(text: string): number {
    let bytes = 0;
    for (const char of text) {
        const codePoint = char.codePointAt(0)!;
        if (codePoint < 0x80) {
            bytes += 1;
        } else if (codePoint < 0x800) {
            bytes += 2;
        } else if (codePoint < 0x10000) {
            bytes += 3;
        } else {
            bytes += 4;
        }
    }
    return bytes;
}

/**
 * Cuts typed or pasted text down to what the server accepts, whole characters
 * at a time so a multibyte character is never split.
 */
export function limitTextValue(text: string): string {
    if (utf8ByteLength(text.trim()) <= TEXT_VALUE_MAX_BYTES) {
        return text;
    }

    let kept = '';
    for (const char of text) {
        if (utf8ByteLength((kept + char).trim()) > TEXT_VALUE_MAX_BYTES) {
            break;
        }
        kept += char;
    }
    return kept;
}

// `model.IsValidEmail` takes only a bare `local@domain` that Go's `net/mail`
// parses back unchanged: both halves dot-atoms, so no spaces, specials, or
// empty or doubled dots.
const ATOM = '[^\\x00-\\x20\\x7f()<>\\[\\]:;@\\\\,".]+';
const DOT_ATOM = `${ATOM}(?:\\.${ATOM})*`;
const EMAIL_PATTERN = new RegExp(`^${DOT_ATOM}@${DOT_ATOM}$`);

// `new URL` repairs `https:example.com` into a URL with a host, which Go's
// `url.ParseRequestURI` does not, so the `//` is required up front.
const URL_PREFIX_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

function isValidUrl(text: string): boolean {
    if (!URL_PREFIX_PATTERN.test(text)) {
        return false;
    }

    try {
        return new URL(text).host !== '';
    } catch {
        return false;
    }
}

/**
 * Why the server would refuse this text for the field's `value_type`, or
 * undefined when it would accept it. An empty value is always accepted.
 */
export function validateTextValue(field: PropertyField, text: string): MessageDescriptor | undefined {
    const trimmed = text.trim();
    if (!trimmed) {
        return undefined;
    }

    switch (field.attrs?.value_type) {
    case 'email':
        if (!EMAIL_PATTERN.test(trimmed)) {
            return messages.invalidEmail;
        }
        if (trimmed !== trimmed.toLowerCase()) {
            return messages.uppercaseEmail;
        }
        return undefined;
    case 'url':
        return isValidUrl(trimmed) ? undefined : messages.invalidUrl;
    default:
        return undefined;
    }
}
