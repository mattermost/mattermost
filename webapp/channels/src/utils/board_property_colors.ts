// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';
import {defineMessage} from 'react-intl';

import {BOARDS_COLOR_TOKEN_NAMES, type BoardsColorToken} from '@mattermost/types/properties_board';

// Token names live in @mattermost/types/properties_board; hex values +
// labels are presentation-only and live here.
export {BOARDS_COLOR_TOKEN_NAMES, type BoardsColorToken};

export type ColorDescriptor<K extends BoardsColorToken = BoardsColorToken> = {
    id: K;
    color: string;
    label: MessageDescriptor;
};

// Mapped type forces each entry's `id` to literally match its key — catches
// copy-paste mistakes like `orange: {id: 'green', ...}` at compile time.
export const COLOR_DESCRIPTOR: {[K in BoardsColorToken]: ColorDescriptor<K>} = {
    default: {
        id: 'default',
        color: '#f0f0f1',
        label: defineMessage({id: 'property_option.color.default', defaultMessage: 'Default'}),
    },
    brown: {
        id: 'brown',
        color: '#f1d9bb',
        label: defineMessage({id: 'property_option.color.brown', defaultMessage: 'Brown'}),
    },
    orange: {
        id: 'orange',
        color: '#f8cfb9',
        label: defineMessage({id: 'property_option.color.orange', defaultMessage: 'Orange'}),
    },
    yellow: {
        id: 'yellow',
        color: '#f4eead',
        label: defineMessage({id: 'property_option.color.yellow', defaultMessage: 'Yellow'}),
    },
    green: {
        id: 'green',
        color: '#c5e6bb',
        label: defineMessage({id: 'property_option.color.green', defaultMessage: 'Green'}),
    },
    blue: {
        id: 'blue',
        color: '#aec9f5',
        label: defineMessage({id: 'property_option.color.blue', defaultMessage: 'Blue'}),
    },
    purple: {
        id: 'purple',
        color: '#dfcaff',
        label: defineMessage({id: 'property_option.color.purple', defaultMessage: 'Purple'}),
    },
    pink: {
        id: 'pink',
        color: '#f9d2e6',
        label: defineMessage({id: 'property_option.color.pink', defaultMessage: 'Pink'}),
    },
    red: {
        id: 'red',
        color: '#f3a4a0',
        label: defineMessage({id: 'property_option.color.red', defaultMessage: 'Red'}),
    },
};

const isColorToken = (s: string): s is BoardsColorToken => Object.hasOwn(COLOR_DESCRIPTOR, s);

// Unknown tokens (e.g. v1's `"neutral"` before the v2 migration rewrites
// it server-side) fall through to `"default"`.
export const normalizeColor = (token: string | undefined): BoardsColorToken => {
    if (token && isColorToken(token)) {
        return token;
    }
    return 'default';
};

export const resolveColor = (token: string | undefined): string => COLOR_DESCRIPTOR[normalizeColor(token)].color;
