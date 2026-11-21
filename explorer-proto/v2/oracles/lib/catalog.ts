// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type CatalogEntry = {
    oracle: string;
    classes: string[];
    summary: string;
    /** Needs the explorer to type text into a field. */
    needs_typing: boolean;
    /** Needs the explorer to press a key (Enter). */
    needs_enter: boolean;
};

export const CATALOG: CatalogEntry[] = [
    {
        oracle: 'O-CONSOLE',
        classes: ['console-error', 'uncaught-exception'],
        summary: 'console.error calls and uncaught page errors (resource-load failures are left to O-NET)',
        needs_typing: false,
        needs_enter: false,
    },
    {
        oracle: 'O-NET',
        classes: ['http-4xx', 'http-5xx', 'request-failed', 'ws-error', 'ws-close'],
        summary: 'app-origin responses with status >= 400, failed requests, WebSocket errors and unexpected closes',
        needs_typing: false,
        needs_enter: false,
    },
    {
        oracle: 'O-A11Y',
        classes: ['empty-accessible-name', 'dangling-aria-reference', 'duplicate-landmark', 'dialog-without-name'],
        summary: 'structure checks on the accessibility-snapshot text and aria-labelledby/describedby ids in the DOM',
        needs_typing: false,
        needs_enter: false,
    },
    {
        oracle: 'O-UIREST',
        classes: ['ui-rest-mismatch'],
        summary: 'declarative check.json: UI value vs a REST field, mismatch must persist past a settle window',
        needs_typing: false,
        needs_enter: false,
    },
    {
        oracle: 'O-MODAL',
        classes: ['enter-submits-while-disabled', 'non-ok-submit-without-feedback'],
        summary:
            'Enter with a disabled confirm button must send nothing; a non-2xx submit needs error text or an open dialog',
        needs_typing: true,
        needs_enter: true,
    },
];
