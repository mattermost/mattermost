// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';
import {defineMessages} from 'react-intl';

import {COLOR_TOKEN_NAMES, type ColorToken} from '@mattermost/types/properties';

// Token names live in @mattermost/types; hex values + labels are presentation-only and live here.
export {COLOR_TOKEN_NAMES, type ColorToken};

export const colorTokenMap: Record<ColorToken, string> = {
    default: '#f0f0f1',
    brown: '#f1d9bb',
    orange: '#f8cfb9',
    yellow: '#f4eead',
    green: '#c5e6bb',
    blue: '#aec9f5',
    purple: '#dfcaff',
    pink: '#f9d2e6',
    red: '#f3a4a0',
};

// Legacy "neutral" → "default" for older seeded data.
const COLOR_ALIASES: Record<string, ColorToken> = {
    neutral: 'default',
};

export const normalizeColor = (token: string | undefined): ColorToken => {
    const t = token ?? 'default';
    const aliased = COLOR_ALIASES[t] ?? (t as ColorToken);
    return COLOR_TOKEN_NAMES.includes(aliased) ? aliased : 'default';
};

export const resolveColor = (token: string | undefined): string => colorTokenMap[normalizeColor(token)];

export const colorTokenLabels: Record<ColorToken, MessageDescriptor> = defineMessages({
    default: {id: 'property_option.color.default', defaultMessage: 'Default'},
    brown: {id: 'property_option.color.brown', defaultMessage: 'Brown'},
    orange: {id: 'property_option.color.orange', defaultMessage: 'Orange'},
    yellow: {id: 'property_option.color.yellow', defaultMessage: 'Yellow'},
    green: {id: 'property_option.color.green', defaultMessage: 'Green'},
    blue: {id: 'property_option.color.blue', defaultMessage: 'Blue'},
    purple: {id: 'property_option.color.purple', defaultMessage: 'Purple'},
    pink: {id: 'property_option.color.pink', defaultMessage: 'Pink'},
    red: {id: 'property_option.color.red', defaultMessage: 'Red'},
});
