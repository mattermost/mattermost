// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import type {IntlShape} from 'react-intl';

import {getModule} from 'module_registry';
import Constants from 'utils/constants';
import {t} from 'utils/i18n';
import {latinise} from 'utils/latinise';
import * as TextFormatting from 'utils/text_formatting';

type WindowObject = {
    location: {
        origin: string;
        protocol: string;
        hostname: string;
        port: string;
    };
    basename?: string;
}

export function cleanUpUrlable(input: string): string {
    let cleaned: string = latinise(input);
    cleaned = cleaned.trim().replace(/-/g, ' ').replace(/[^\w\s]/gi, '').toLowerCase().replace(/\s/g, '-');
    cleaned = cleaned.replace(/^-+/, '');
    cleaned = cleaned.replace(/-+$/, '');
    return cleaned;
}

export function getShortenedURL(url = '', getLength = 27): string {
    if (url.length > 35) {
        const subLength = getLength - 14;
        return url.substring(0, 10) + '...' + url.substring(url.length - subLength, url.length);
    }
    return url;
}

export function getSiteURLFromWindowObject(obj: WindowObject): string {
    let siteURL = '';
    if (obj.location.origin) {
        siteURL = obj.location.origin;
    } else {
        siteURL = obj.location.protocol + '//' + obj.location.hostname + (obj.location.port ? ':' + obj.location.port : '');
    }

    if (siteURL[siteURL.length - 1] === '/') {
        siteURL = siteURL.substring(0, siteURL.length - 1);
    }

    if (obj.basename) {
        siteURL += obj.basename;
    }

    if (siteURL[siteURL.length - 1] === '/') {
        siteURL = siteURL.substring(0, siteURL.length - 1);
    }

    return siteURL;
}

export function getSiteURL(): string {
    return getModule<() => string>('utils/url/getSiteURL')?.() ?? getSiteURLFromWindowObject(window);
}

export function getBasePathFromWindowObject(obj: WindowObject): string {
    return obj.basename || '';
}

export function getBasePath(): string {
    return getBasePathFromWindowObject(window);
}

export function getRelativeChannelURL(teamName: string, channelName: string): string {
    return `/${teamName}/channels/${channelName}`;
}

export function isUrlSafe(url: string): boolean {
    let unescaped: string;

    try {
        unescaped = decodeURIComponent(url);
    } catch (e) {
        unescaped = unescape(url);
    }

    unescaped = unescaped.replace(/[^\w:]/g, '').toLowerCase();

    return !unescaped.startsWith('javascript:') && // eslint-disable-line no-script-url
        !unescaped.startsWith('vbscript:') &&
        !unescaped.startsWith('data:');
}

export function makeUrlSafe(url: string, defaultUrl = ''): string {
    if (isUrlSafe(url)) {
        return url;
    }

    return defaultUrl;
}

export function getScheme(url: string): string | null {
    const match = (/([a-z0-9+.-]+):/i).exec(url);

    return match && match[1];
}

function formattedError(id: string, message: string, intl?: IntlShape): React.ReactElement | string {
    if (intl) {
        return intl.formatMessage({id, defaultMessage: message});
    }

    return (<span key={id}>
        <FormattedMessage
            id={id}
            defaultMessage={message}
        />
        <br/>
    </span>);
}

export function validateChannelUrl(url: string, intl?: IntlShape): Array<React.ReactElement | string> {
    const errors: Array<React.ReactElement | string> = [];

    const USER_ID_LENGTH = 26;
    const directMessageRegex = new RegExp(`^.{${USER_ID_LENGTH}}__.{${USER_ID_LENGTH}}$`);
    const isDirectMessageFormat = directMessageRegex.test(url);

    const cleanedURL = cleanUpUrlable(url);
    const urlMatched = url.match(/^[a-z0-9]([a-z0-9\-_]*[a-z0-9])?$/);
    const urlLonger = url.length < Constants.MIN_CHANNELNAME_LENGTH;
    const urlShorter = url.length > Constants.MAX_CHANNELNAME_LENGTH;

    if (cleanedURL !== url || !urlMatched || urlMatched[0] !== url || isDirectMessageFormat || urlLonger || urlShorter) {
        if (urlLonger) {
            errors.push(formattedError(t('change_url.longer'), 'URLs must have at least 2 characters.', intl));
        }

        if (urlShorter) {
            errors.push(formattedError(t('change_url.shorter'), 'URLs must have maximum 64 characters.', intl));
        }

        if (url.match(/[^A-Za-z0-9-_]/)) {
            errors.push(formattedError(t('change_url.noSpecialChars'), 'URLs cannot use special characters.', intl));
        }

        if (isDirectMessageFormat) {
            errors.push(formattedError(t('change_url.invalidDirectMessage'), 'User IDs are not allowed in channel URLs.', intl));
        }

        const startsWithoutLetter = url.charAt(0) === '-' || url.charAt(0) === '_';
        const endsWithoutLetter = url.length > 1 && (url.charAt(url.length - 1) === '-' || url.charAt(url.length - 1) === '_');
        if (startsWithoutLetter && endsWithoutLetter) {
            errors.push(formattedError(t('change_url.startAndEndWithLetter'), 'URLs must start and end with a lowercase letter or number.', intl));
        } else if (startsWithoutLetter) {
            errors.push(formattedError(t('change_url.startWithLetter'), 'URLs must start with a lowercase letter or number.', intl));
        } else if (endsWithoutLetter) {
            errors.push(formattedError(t('change_url.endWithLetter'), 'URLs must end with a lowercase letter or number.', intl));
        }

        // In case of error we don't detect
        if (errors.length === 0) {
            errors.push(formattedError(t('change_url.invalidUrl'), 'Invalid URL', intl));
        }
    }

    return errors;
}

export function isInternalURL(url: string, siteURL?: string): boolean {
    return url.startsWith(siteURL || '') || url.startsWith('/');
}

export function shouldOpenInNewTab(url: string, siteURL?: string, managedResourcePaths?: string[]): boolean {
    if (!isInternalURL(url, siteURL)) {
        return true;
    }

    const path = url.startsWith('/') ? url : url.substring(siteURL?.length || 0);

    const unhandledPaths = [

        // Paths managed by plugins and public file links aren't handled by the web app
        'plugins',
        'files',

        // Internal help pages should always open in a new tab
        'help',
    ];

    // Paths managed by another service shouldn't be handled by the web app either
    if (managedResourcePaths) {
        for (const managedPath of managedResourcePaths) {
            unhandledPaths.push(TextFormatting.escapeRegex(managedPath));
        }
    }

    return unhandledPaths.some((unhandledPath) => new RegExp('^/' + unhandledPath + '\\b').test(path));
}

// Returns true if the string passed is a permalink URL.
export function isPermalinkURL(url: string): boolean {
    const siteURL = getSiteURL();

    const regexp = new RegExp(`^(${siteURL})?/[a-z0-9]+([a-z\\-0-9]+|(__)?)[a-z0-9]+/pl/\\w+`, 'gu');

    return isInternalURL(url, siteURL) && (regexp.test(url));
}

export function isStringContainingUrl(text: string): boolean {
    const regex = new RegExp('(https?://|www.)');
    return regex.test(text);
}

export type UrlValidationCheck = {
    url: string;
    error: typeof BadUrlReasons[keyof typeof BadUrlReasons] | false;
}

export const BadUrlReasons = {
    Empty: 'Empty',
    Length: 'Length',
    Reserved: 'Reserved',
    Taken: 'Taken',
} as const;

export function teamNameToUrl(teamName: string): UrlValidationCheck {
    // borrowed from team_url, which has some peculiarities tied to being a part of a two screen UI
    // that allows more variation between team name and url than we allow in usages of this function
    const url = cleanUpUrlable(teamName.trim());

    if (!url) {
        return {url, error: BadUrlReasons.Empty};
    }

    if (url.length < Constants.MIN_TEAMNAME_LENGTH || url.length > Constants.MAX_TEAMNAME_LENGTH) {
        return {url, error: BadUrlReasons.Length};
    }

    if (Constants.RESERVED_TEAM_NAMES.some((reservedName) => url.startsWith(reservedName))) {
        return {url, error: BadUrlReasons.Reserved};
    }

    return {url, error: false};
}

export function channelNameToUrl(channelName: string): UrlValidationCheck {
    // borrowed from team_url, which has some peculiarities tied to being a part of a two screen UI
    // that allows more variation between team name and url than we allow in usages of this function
    const url = cleanUpUrlable(channelName.trim());

    if (!url) {
        return {url, error: BadUrlReasons.Empty};
    }

    if (url.length < Constants.MIN_CHANNELNAME_LENGTH || url.length > Constants.MAX_CHANNELNAME_LENGTH) {
        return {url, error: BadUrlReasons.Length};
    }

    return {url, error: false};
}
