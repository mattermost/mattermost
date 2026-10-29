// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getDocumentationURL, getMattermostDocumentationURL, MATTERMOST_DOCS_URL} from './documentation';

describe('getMattermostDocumentationURL', () => {
    test.each([
        ['https://chat.example.com', 'https://chat.example.com/_documentation/'],
        ['https://chat.example.com/', 'https://chat.example.com/_documentation/'],
        ['http://localhost:8065', 'http://localhost:8065/_documentation/'],
        ['https://example.com/mattermost', MATTERMOST_DOCS_URL],
        ['https://example.com/mattermost/', MATTERMOST_DOCS_URL],
        ['', MATTERMOST_DOCS_URL],
        ['not a url', MATTERMOST_DOCS_URL],
    ])('maps %s', (siteURL, expected) => {
        expect(getMattermostDocumentationURL(siteURL)).toBe(expected);
    });
});

describe('getDocumentationURL', () => {
    const siteURL = 'https://chat.example.com';

    test.each([
        ['https://docs.mattermost.com', 'https://chat.example.com/_documentation/'],
        ['https://docs.mattermost.com/', 'https://chat.example.com/_documentation/'],
        [
            'https://docs.mattermost.com/end-user-guide/collaborate/format-messages.html',
            'https://chat.example.com/_documentation/end-user-guide/collaborate/format-messages',
        ],
        [
            'http://docs.mattermost.com/deployment/sso-saml.html',
            'https://chat.example.com/_documentation/deployment/sso-saml',
        ],
        [
            'https://docs.mattermost.com/welcome/about-teams.html#team-url',
            'https://chat.example.com/_documentation/welcome/about-teams#team-url',
        ],
        [
            'https://docs.mattermost.com/administration-guide/upgrade/upgrade-mattermost?tab=linux#overview',
            'https://chat.example.com/_documentation/administration-guide/upgrade/upgrade-mattermost?tab=linux#overview',
        ],
        ['https://developers.mattermost.com', 'https://chat.example.com/_documentation/developers'],
        [
            'https://developers.mattermost.com/integrate/slash-commands/custom/',
            'https://chat.example.com/_documentation/developers/integrate/slash-commands/custom',
        ],
    ])('rewrites %s', (url, expected) => {
        expect(getDocumentationURL(url, siteURL)).toBe(expected);
    });

    test.each([
        'https://mattermost.com/pl/default-ask-mattermost-community/',
        'https://academy.mattermost.com/',
        'https://api.mattermost.com/',
        'https://docs.mattermost.com.example.com/administration-guide',
        'https://example.com/docs.mattermost.com/administration-guide',
        'mailto:docs@mattermost.com',
        '/_documentation/',
        'not a url',
    ])('leaves %s unchanged', (url) => {
        expect(getDocumentationURL(url, siteURL)).toBe(url);
    });

    test.each([
        'https://example.com/mattermost',
        '',
        'not a url',
    ])('keeps public docs when bundled docs are unavailable for SiteURL %s', (unavailableSiteURL) => {
        const url = 'https://developers.mattermost.com/integrate/slash-commands/custom/';
        expect(getDocumentationURL(url, unavailableSiteURL)).toBe(url);
    });
});
