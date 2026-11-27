// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';
import type {IntlShape, MessageDescriptor} from 'react-intl';

import {getModule} from 'module_registry';
import Constants from 'utils/constants';
import {latinise} from 'utils/latinise';

import {unescapeHtmlEntities} from './markdown/renderer';

type WindowObject = {
    location: {
        origin: string;
        protocol: string;
        hostname: string;
        port: string;
    };
    basename?: string;
};

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
    } catch {
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
    const match = (/^!?([a-z0-9+.-]+):/i).exec(url);

    return match && match[1];
}

export function removeScheme(url: string) {
    return url.replace(/^([a-z0-9+.-]+):\/\//i, '');
}

function formattedError(message: MessageDescriptor, intl?: IntlShape): React.ReactElement<any> | string {
    if (intl) {
        return intl.formatMessage(message);
    }

    return (
        <span key={message.id}>
            <FormattedMessage
                {...message}
            />
            <br/>
        </span>
    );
}

export function validateChannelUrl(url: string, intl?: IntlShape): Array<React.ReactElement<any> | string> {
    const errors: Array<React.ReactElement<any> | string> = [];

    const USER_ID_LENGTH = 26;
    const directMessageRegex = new RegExp(`^.{${USER_ID_LENGTH}}__.{${USER_ID_LENGTH}}$`);
    const isDirectMessageFormat = directMessageRegex.test(url);

    const cleanedURL = cleanUpUrlable(url);
    const urlMatched = url.match(/^[a-z0-9]([a-z0-9\-_]*[a-z0-9])?$/);
    const urlLonger = url.length < Constants.MIN_CHANNELNAME_LENGTH;
    const urlShorter = url.length > Constants.MAX_CHANNELNAME_LENGTH;

    if (cleanedURL !== url || !urlMatched || urlMatched[0] !== url || isDirectMessageFormat || urlLonger || urlShorter) {
        if (urlLonger) {
            errors.push(formattedError(
                defineMessage({
                    id: 'change_url.longer',
                    defaultMessage: 'URLs must have at least 1 character.',
                }),
                intl,
            ));
        }

        if (urlShorter) {
            errors.push(formattedError(
                defineMessage({
                    id: 'change_url.shorter',
                    defaultMessage: 'URLs must have maximum 64 characters.',
                }),
                intl,
            ));
        }

        if (url.match(/[^A-Za-z0-9-_]/)) {
            errors.push(formattedError(
                defineMessage({
                    id: 'change_url.noSpecialChars',
                    defaultMessage: 'URLs cannot use special characters.',
                }),
                intl,
            ));
        }

        if (isDirectMessageFormat) {
            errors.push(formattedError(
                defineMessage({
                    id: 'change_url.invalidDirectMessage',
                    defaultMessage: 'User IDs are not allowed in channel URLs.',
                }),
                intl,
            ));
        }

        const startsWithoutLetter = url.charAt(0) === '-' || url.charAt(0) === '_';
        const endsWithoutLetter = url.length > 1 && (url.charAt(url.length - 1) === '-' || url.charAt(url.length - 1) === '_');
        if (startsWithoutLetter && endsWithoutLetter) {
            errors.push(formattedError(
                defineMessage({
                    id: 'change_url.startAndEndWithLetter',
                    defaultMessage: 'URLs must start and end with a lowercase letter or number.',
                }),
                intl,
            ));
        } else if (startsWithoutLetter) {
            errors.push(formattedError(
                defineMessage({
                    id: 'change_url.startWithLetter',
                    defaultMessage: 'URLs must start with a lowercase letter or number.',
                }),
                intl,
            ));
        } else if (endsWithoutLetter) {
            errors.push(formattedError(
                defineMessage({
                    id: 'change_url.endWithLetter',
                    defaultMessage: 'URLs must end with a lowercase letter or number.',
                }),
                intl,
            ));
        }

        // In case of error we don't detect
        if (errors.length === 0) {
            errors.push(formattedError(
                defineMessage({
                    id: 'change_url.invalidUrl',
                    defaultMessage: 'Invalid URL',
                }),
                intl,
            ));
        }
    }

    return errors;
}

// Returns true when the URL could possibly cause any external requests.
// Currently returns false only for permalinks
const permalinkPath = new RegExp('^/[0-9a-z_-]{1,64}/pl/[0-9a-z_-]{26}(\\?view=citation)?$');
export function mightTriggerExternalRequest(url: string, siteURL?: string): boolean {
    if (siteURL && siteURL !== '') {
        let standardSiteURL = siteURL;
        if (standardSiteURL[standardSiteURL.length - 1] === '/') {
            standardSiteURL = standardSiteURL.substring(0, standardSiteURL.length - 1);
        }
        if (!url.startsWith(standardSiteURL)) {
            return true;
        }
        const afterSiteURL = url.substring(standardSiteURL.length);
        return !permalinkPath.test(afterSiteURL);
    }
    return true;
}

export function isInternalURL(url: string, siteURL?: string): boolean {
    return url.startsWith(siteURL || '') || url.startsWith('/') || url.startsWith('#');
}

const IMAGE_PROXY_SUFFIX = '/api/v4/image';

function isImageProxyPath(pathname: string, sitePath: string): boolean {
    const proxyPath = sitePath + IMAGE_PROXY_SUFFIX;
    return pathname === proxyPath || pathname.startsWith(proxyPath + '/');
}

function normalizePathname(pathname: string): string {
    let decoded: string;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        decoded = pathname.split('/').map((segment) => {
            try {
                return decodeURIComponent(segment);
            } catch {
                return segment;
            }
        }).join('/');
    }
    const parts = decoded.replace(/\/+/g, '/').split('/');
    const stack: string[] = [];
    for (const part of parts) {
        if (!part || part === '.') {
            continue;
        }
        if (part === '..') {
            stack.pop();
        } else {
            stack.push(part);
        }
    }
    return '/' + stack.join('/');
}

let cachedSiteURL: string | undefined;
let cachedSiteBase: {base: URL; sitePath: string} | null = null;

function parseSiteBase(siteURL: string): {base: URL; sitePath: string} | null {
    if (cachedSiteURL === siteURL) {
        return cachedSiteBase;
    }
    let parsed: {base: URL; sitePath: string} | null = null;
    try {
        const site = new URL(siteURL);
        if ((site.protocol === 'http:' || site.protocol === 'https:') && site.username === '' && site.password === '') {
            const cleanSitePath = normalizePathname(site.pathname);
            const sitePath = cleanSitePath === '/' ? '' : cleanSitePath;
            parsed = {base: new URL(site.origin + sitePath + '/'), sitePath};
        }
    } catch {
        parsed = null;
    }
    cachedSiteURL = siteURL;
    cachedSiteBase = parsed;
    return parsed;
}

function hasControlOrBackslash(rawURL: string): boolean {
    for (let i = 0; i < rawURL.length; i++) {
        const code = rawURL.charCodeAt(i);
        if (rawURL[i] === '\\' || code < 0x20 || code === 0x7f) {
            return true;
        }
    }
    return false;
}

function resolveInternalImageURL(rawURL: string, siteURL?: string): {resolved: URL; cleanPath: string; sitePath: string} | null {
    if (!rawURL || rawURL !== rawURL.trim() || hasControlOrBackslash(rawURL) || rawURL.startsWith('//')) {
        return null;
    }
    try {
        if (!siteURL) {
            if ((/^[a-zA-Z][a-zA-Z0-9+.-]*:/).test(rawURL)) {
                return null;
            }
            const resolved = new URL(rawURL, 'http://localhost/');
            if (resolved.username !== '' || resolved.password !== '') {
                return null;
            }
            return {resolved, cleanPath: normalizePathname(resolved.pathname), sitePath: ''};
        }
        if ((/^[a-zA-Z][a-zA-Z0-9+.-]*:/).test(rawURL) && !(/^https?:\/\//i).test(rawURL)) {
            return null;
        }
        const parsedSite = parseSiteBase(siteURL);
        if (!parsedSite) {
            return null;
        }
        const {base, sitePath} = parsedSite;
        const resolved = new URL(rawURL, base);
        if (
            resolved.protocol !== base.protocol ||
            resolved.origin !== base.origin ||
            resolved.username !== '' ||
            resolved.password !== ''
        ) {
            return null;
        }
        return {resolved, cleanPath: normalizePathname(resolved.pathname), sitePath};
    } catch {
        return null;
    }
}

function resolveImageProxyURL(rawURL: string, siteURL?: string): URL | null {
    const info = resolveInternalImageURL(rawURL, siteURL);
    if (!info || !isImageProxyPath(info.cleanPath, info.sitePath)) {
        return null;
    }
    return info.resolved;
}

export function isImageProxyURL(rawURL: string, siteURL?: string): boolean {
    return resolveImageProxyURL(rawURL, siteURL) !== null;
}

export function unwrapImageProxyURL(rawURL: string, siteURL?: string): string {
    const resolved = resolveImageProxyURL(rawURL, siteURL);
    if (!resolved) {
        return rawURL;
    }
    const target = resolved.searchParams.get('url');
    if (target && isUrlSafe(target)) {
        return target;
    }
    return rawURL;
}

export function isExternalImageURL(rawURL: string, siteURL?: string): boolean {
    if (!rawURL) {
        return false;
    }
    if (rawURL.toLowerCase().startsWith('data:image/')) {
        return false;
    }
    const info = resolveInternalImageURL(rawURL, siteURL);
    if (!info) {
        return true;
    }
    const {cleanPath, sitePath} = info;
    if (sitePath && cleanPath !== sitePath && !cleanPath.startsWith(sitePath + '/')) {
        return true;
    }
    return isImageProxyPath(cleanPath, sitePath);
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

        // Bundled documentation is served by the server, not the web app's router
        '_documentation',
    ];

    // Paths managed by another service shouldn't be handled by the web app either
    if (managedResourcePaths) {
        for (const managedPath of managedResourcePaths) {
            unhandledPaths.push(RegExp.escape(managedPath));
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

export function isValidUrl(url = '') {
    const regex = /^https?:\/\//i;
    return regex.test(url);
}

export function isStringContainingUrl(text: string): boolean {
    const regex = new RegExp('(https?://|www.)');
    return regex.test(text);
}

export type UrlValidationCheck = {
    url: string;
    error: typeof BadUrlReasons[keyof typeof BadUrlReasons] | false;
};

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

export function parseLink(href: string, defaultSecure = location.protocol === 'https:') {
    let outHref = href;

    if (!href.startsWith('/')) {
        const scheme = getScheme(href);
        if (!scheme) {
            outHref = `${defaultSecure ? 'https' : 'http'}://${outHref}`;
        }
    }

    if (!isUrlSafe(unescapeHtmlEntities(href))) {
        return undefined;
    }

    return outHref;
}

export const validHttpUrl = (input: string) => {
    const val = parseLink(input);

    if (!val || !isValidUrl(val)) {
        return null;
    }

    let url;
    try {
        url = new URL(val);
    } catch {
        return null;
    }

    return url;
};
