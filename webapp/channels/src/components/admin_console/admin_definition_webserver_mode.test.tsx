// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import AdminDefinition from './admin_definition';
import type {AdminDefinitionSetting, AdminDefinitionSubSection, ConsoleAccess} from './types';

type DisabledCheck = (config: object, state: object, license: undefined, enterpriseReady: boolean, consoleAccess: ConsoleAccess) => boolean;

const WEBSERVER_MODE_KEY = 'ServiceSettings.WebserverMode';

function settingsOf(subsection: AdminDefinitionSubSection): AdminDefinitionSetting[] {
    const schema = subsection.schema;

    return schema && 'settings' in schema && schema.settings ? schema.settings : [];
}

function writeAccessTo(resourceKey: string): ConsoleAccess {
    return {read: {}, write: {[resourceKey]: true}};
}

describe('AdminDefinition - Webserver Mode setting', () => {
    const getSetting = () => settingsOf(AdminDefinition.environment.subsections.web_server).
        find((setting) => setting.key === WEBSERVER_MODE_KEY);

    const getOptions = () => {
        const setting = getSetting();
        return setting && 'options' in setting ? setting.options : undefined;
    };

    test('is rendered as a dropdown on the Environment > Web Server page', () => {
        const setting = getSetting();

        expect(setting).toBeDefined();
        expect(setting?.type).toBe('dropdown');
        expect(setting?.label).toBeDefined();
        expect(setting?.help_text).toBeDefined();
    });

    test('offers every supported mode, ordered by descending compression capability', () => {
        expect(getOptions()?.map((option) => option.value)).toEqual(['brotli', 'gzip', 'uncompressed', 'disabled']);
    });

    test('gives every mode a display name', () => {
        const options = getOptions();

        expect(options).toHaveLength(4);
        options?.forEach((option) => {
            expect(option.display_name).toBeDefined();
        });
    });

    test('is gated on write access to the Web Server console resource', () => {
        const isDisabled = getSetting()?.isDisabled as DisabledCheck;
        expect(typeof isDisabled).toBe('function');

        expect(isDisabled({}, {}, undefined, true, writeAccessTo(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER))).toBe(false);
        expect(isDisabled({}, {}, undefined, true, writeAccessTo(RESOURCE_KEYS.EXPERIMENTAL.FEATURES))).toBe(true);
    });
});
