// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import AdminDefinition from './admin_definition';
import type {Check, ConsoleAccess} from './types';

const readAccess = {
    read: {
        [RESOURCE_KEYS.SITE.AI_RECAPS]: true,
    },
    write: {},
} as ConsoleAccess;

const noAccess = {
    read: {},
    write: {},
} as ConsoleAccess;

function isHidden(config: Partial<AdminConfig>, access: ConsoleAccess = readAccess) {
    const check = AdminDefinition.site.subsections.recaps.isHidden as Extract<Check, (...args: any[]) => boolean>;
    return check(config, {}, {}, true, access);
}

describe('AdminDefinition - Recaps', () => {
    test('hides Recaps when EnableAIRecaps is disabled', () => {
        const mockConfig: Partial<AdminConfig> = {FeatureFlags: {EnableAIRecaps: false}};
        expect(isHidden(mockConfig)).toBe(true);
    });

    test('shows Recaps when EnableAIRecaps is enabled and user has permission', () => {
        const mockConfig: Partial<AdminConfig> = {FeatureFlags: {EnableAIRecaps: true}};
        expect(isHidden(mockConfig)).toBe(false);
    });

    test('hides Recaps when user lacks permission even if the flag is enabled', () => {
        const mockConfig: Partial<AdminConfig> = {FeatureFlags: {EnableAIRecaps: true}};
        expect(isHidden(mockConfig, noAccess)).toBe(true);
    });
});
