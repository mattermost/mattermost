// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** Shared payloads for interactive message translation tests. */

export {
    ADAPTIVE_CARDS_COMPLEX,
    ATTACHMENTS_COMPLEX,
    BLOCK_KIT_COMPLEX,
    MM_BLOCKS_COMPLEX,
} from './test_fixtures_complex';

export const MM_BLOCKS_SIMPLE = [
    {
        type: 'text',
        text: 'Hello **from** mm blocks',
    },
    {
        type: 'button',
        text: 'Sample action',
        style: 'primary',
        action_id: 'mm_blocks_demo',
    },
] as const;

export const ATTACHMENTS_SIMPLE = [
    {
        color: '#36a64f',
        pretext: 'Optional pretext',
        author_name: 'Bot Author',
        title: 'Attachment title',
        title_link: 'https://example.com',
        text: 'Body *markdown* text',
    },
] as const;

export const BLOCK_KIT_SIMPLE = [
    {
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: '*Hello* from Block Kit',
        },
    },
    {
        type: 'divider',
    },
    {
        type: 'actions',
        elements: [
            {
                type: 'button',
                text: {type: 'plain_text', text: 'OK'},
                action_id: 'block_kit_demo',
            },
        ],
    },
] as const;

export const ADAPTIVE_CARDS_SIMPLE = [
    {
        type: 'AdaptiveCard',
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        version: '1.5',
        body: [
            {
                type: 'TextBlock',
                text: 'Hello from an Adaptive Card',
                wrap: true,
            },
        ],
    },
] as const;

/** Malformed or partially invalid payloads. */
export const MALFORMED_MM_BLOCKS_ONLY_INVALID = [
    null,
    'not-an-object',
    {type: 'unknown_future_block'},
    {type: 'button', text: 'Missing action_id'},
    {type: 'text'},
    {type: 'static_select'},
    {type: 'container', content: 'not-an-array'},
] as const;

export const MALFORMED_MM_BLOCKS_MIXED = [
    {type: 'text', text: 'Valid block'},
    null,
    {type: 'button', text: 'No id'},
    {
        type: 'button',
        text: 'Good',
        action_id: 'valid_btn',
        style: 'not-a-real-style',
        extra_unknown_key: true,
    },
] as const;

export const MALFORMED_ATTACHMENTS = [
    null,
    'string-entry',
    {},
    {
        text: 'Only body survives',
        actions: [
            null,
            {name: 'No id button'},
            {type: 'select', name: 'No id select'},
            {
                type: 'select',
                id: 'ok_select',
                name: 'OK',
                options: [{text: 'Only text'}, {text: 'Good', value: 'g'}],
            },
        ],
    },
] as const;

export const MALFORMED_BLOCK_KIT = [
    null,
    {type: 'section'},
    {type: 'actions', elements: 'not-array'},
    {
        type: 'actions',
        elements: [
            {type: 'button', text: {type: 'plain_text', text: 'No action_id'}},
            {
                type: 'static_select',
                action_id: 'sel',
                placeholder: {type: 'plain_text', text: 'Pick'},
                options: [],
            },
        ],
    },
    {type: 'section', text: {type: 'mrkdwn', text: 'Kept section'}},
] as const;

export const MALFORMED_ADAPTIVE_CARDS = [
    null,
    {type: 'AdaptiveCard', body: 'not-array'},
    {
        type: 'AdaptiveCard',
        body: [
            {type: 'Image'},
            {type: 'TextBlock', text: 'Valid line'},
            {type: 'ActionSet', actions: [{type: 'Action.Submit', title: ''}]},
        ],
    },
] as const;
