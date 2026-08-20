// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import AdminDefinition from './admin_definition';
import type {AdminDefinitionSetting, AdminDefinitionSubSection, ConsoleAccess} from './types';

type DisabledCheck = (config: object, state: object, license: undefined, enterpriseReady: boolean, consoleAccess: ConsoleAccess) => boolean;

const CHANNEL_VIEWED_MESSAGES_KEY = 'ServiceSettings.EnableChannelViewedMessages';

function settingsOf(subsection: AdminDefinitionSubSection): AdminDefinitionSetting[] {
    const schema = subsection.schema;

    return schema && 'settings' in schema && schema.settings ? schema.settings : [];
}

function writeAccessTo(resourceKey: string): ConsoleAccess {
    return {read: {}, write: {[resourceKey]: true}};
}

describe('AdminDefinition - Enable Channel Viewed WebSocket Messages setting', () => {
    const getSetting = () => settingsOf(AdminDefinition.environment.subsections.web_server).
        find((setting) => setting.key === CHANNEL_VIEWED_MESSAGES_KEY);

    test('is rendered on the Environment > Web Server page and not under Experimental Features', () => {
        const setting = getSetting();

        expect(setting).toBeDefined();
        expect(setting?.type).toBe('bool');
        expect(setting?.label).toBeDefined();
        expect(setting?.help_text).toBeDefined();

        const experimentalKeys = settingsOf(AdminDefinition.experimental.subsections.experimental_features).map((setting) => setting.key);
        expect(experimentalKeys).not.toContain(CHANNEL_VIEWED_MESSAGES_KEY);
    });

    test('is gated on write access to the Web Server console resource', () => {
        const isDisabled = getSetting()?.isDisabled as DisabledCheck;
        expect(typeof isDisabled).toBe('function');

        expect(isDisabled({}, {}, undefined, true, writeAccessTo(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER))).toBe(false);
        expect(isDisabled({}, {}, undefined, true, writeAccessTo(RESOURCE_KEYS.EXPERIMENTAL.FEATURES))).toBe(true);
    });
});
