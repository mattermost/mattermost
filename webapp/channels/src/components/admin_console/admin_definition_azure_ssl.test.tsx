// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import AdminDefinition from './admin_definition';
import {SchemaAdminSettings, getConfigFromState} from './schema_admin_settings';
import type {AdminDefinitionSetting, AdminDefinitionSubSectionSchema, ConsoleAccess} from './types';

describe('AdminDefinition - Azure Blob Storage SSL setting', () => {
    const schema = AdminDefinition.environment.subsections.storage.schema as AdminDefinitionSubSectionSchema;
    const consoleAccess = {read: {}, write: {[RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE]: true}} as unknown as ConsoleAccess;

    const saveFileStorage = (savedConfig: DeepPartial<AdminConfig>, stateOverrides: Record<string, unknown> = {}) => {
        const config = savedConfig as Partial<AdminConfig>;
        const state = {...SchemaAdminSettings.getStateFromConfig(config, schema), ...stateOverrides};
        const isDisabled = (setting: AdminDefinitionSetting) => {
            if (typeof setting.isDisabled === 'function') {
                return setting.isDisabled(config, state, undefined, true, consoleAccess);
            }
            return Boolean(setting.isDisabled);
        };

        return getConfigFromState(JSON.parse(JSON.stringify(config)), state, schema, isDisabled);
    };

    test('keeps a saved AzureSSL value when saving with the local file system driver', () => {
        const config = saveFileStorage({FileSettings: {DriverName: 'local', AzureSSL: true, AzureCloud: 'commercial'}});

        expect(config.FileSettings?.AzureSSL).toBe(true);
    });

    test('keeps a saved AzureSSL value when switching from Azure Blob Storage to Amazon S3', () => {
        const config = saveFileStorage(
            {FileSettings: {DriverName: 'azureblob', AzureSSL: true, AzureCloud: 'commercial'}},
            {'FileSettings.DriverName': 'amazons3'},
        );

        expect(config.FileSettings?.DriverName).toBe('amazons3');
        expect(config.FileSettings?.AzureSSL).toBe(true);
    });

    test('keeps a saved AzureSSL value when saving with the Custom Endpoint cloud', () => {
        const config = saveFileStorage({FileSettings: {DriverName: 'azureblob', AzureSSL: true, AzureCloud: 'custom'}});

        expect(config.FileSettings?.AzureSSL).toBe(true);
    });

    test('saves AzureSSL as changed by the admin when Azure Blob Storage is selected', () => {
        const config = saveFileStorage(
            {FileSettings: {DriverName: 'azureblob', AzureSSL: true, AzureCloud: 'commercial'}},
            {'FileSettings.AzureSSL': false},
        );

        expect(config.FileSettings?.AzureSSL).toBe(false);
    });
});
