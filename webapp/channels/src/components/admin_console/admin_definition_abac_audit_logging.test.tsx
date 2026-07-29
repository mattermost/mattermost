// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig, ClientLicense} from '@mattermost/types/config';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {LicenseSkus} from 'utils/constants';

import AdminDefinition from './admin_definition';
import type {AdminDefinitionSettingInput, Check, ConsoleAccess} from './types';

jest.mock('mattermost-redux/selectors/entities/general', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/general'),
    getConfig: jest.fn(),
}));

const mockedGetConfig = getConfig as jest.Mock;

type BoolAdminDefinitionSetting = AdminDefinitionSettingInput;

const enterpriseAdvancedLicense = {
    IsLicensed: 'true',
    SkuShortName: LicenseSkus.EnterpriseAdvanced,
} as ClientLicense;

const professionalLicense = {
    IsLicensed: 'true',
    SkuShortName: LicenseSkus.Professional,
} as ClientLicense;

const consoleAccess = {
    read: {},
    write: {},
} as ConsoleAccess;

const abacFeatureFlagEnabled = {
    FeatureFlags: {
        AttributeBasedAccessControl: true,
    },
} as unknown as Partial<AdminConfig>;

function getAuditLoggingSetting(): BoolAdminDefinitionSetting {
    const subsection = AdminDefinition.system_attributes.subsections.attribute_based_access_control;
    const schema = subsection.schema;
    const sections = 'sections' in schema ? schema.sections ?? [] : [];
    const settings = sections[0]?.settings ?? [];
    const setting = settings.find((s) => s.key === 'AccessControlSettings.EnableAccessControlAuditLogging');
    return setting as BoolAdminDefinitionSetting;
}

function callIsDisabled(check: Check | undefined, state: Record<string, unknown>) {
    const disabledCheck = check as Extract<Check, (...args: any[]) => boolean>;
    return disabledCheck({}, state, enterpriseAdvancedLicense, true, consoleAccess);
}

describe('AdminDefinition - ABAC audit logging toggle', () => {
    afterEach(() => {
        mockedGetConfig.mockReset();
    });

    test('defines the EnableAccessControlAuditLogging bool setting with the expected copy', () => {
        const setting = getAuditLoggingSetting();

        expect(setting).toBeDefined();
        expect(setting.type).toBe('bool');
        expect(setting.key).toBe('AccessControlSettings.EnableAccessControlAuditLogging');
        expect(setting.label).toBeDefined();
        expect((setting.label as {id: string}).id).toBe('admin.accesscontrol.enableAuditLogging.title');
        expect(setting.help_text).toBeDefined();
        expect((setting.help_text as {id: string}).id).toBe('admin.accesscontrol.enableAuditLogging.desc');
        expect(setting.disabled_help_text).toBeDefined();
        expect((setting.disabled_help_text as {id: string}).id).toBe('admin.accesscontrol.enableAuditLogging.disabled');
    });

    test('is enabled when ABAC is on and audit logging is active', () => {
        mockedGetConfig.mockReturnValue({AuditLoggingActive: 'true'});

        const setting = getAuditLoggingSetting();
        const disabled = callIsDisabled(setting.isDisabled, {'AccessControlSettings.EnableAttributeBasedAccessControl': true});

        expect(disabled).toBe(false);
    });

    test('is disabled when ABAC master toggle is off', () => {
        mockedGetConfig.mockReturnValue({AuditLoggingActive: 'true'});

        const setting = getAuditLoggingSetting();
        const disabled = callIsDisabled(setting.isDisabled, {'AccessControlSettings.EnableAttributeBasedAccessControl': false});

        expect(disabled).toBe(true);
    });

    test('is disabled when server audit logging is not active', () => {
        mockedGetConfig.mockReturnValue({AuditLoggingActive: 'false'});

        const setting = getAuditLoggingSetting();
        const disabled = callIsDisabled(setting.isDisabled, {'AccessControlSettings.EnableAttributeBasedAccessControl': true});

        expect(disabled).toBe(true);
    });

    test('is disabled when AuditLoggingActive is undefined (fail-safe default)', () => {
        mockedGetConfig.mockReturnValue({});

        const setting = getAuditLoggingSetting();
        const disabled = callIsDisabled(setting.isDisabled, {'AccessControlSettings.EnableAttributeBasedAccessControl': true});

        expect(disabled).toBe(true);
    });

    test('subsection is hidden below Enterprise Advanced license tier', () => {
        const subsection = AdminDefinition.system_attributes.subsections.attribute_based_access_control;
        const hiddenCheck = subsection.isHidden as Extract<Check, (...args: any[]) => boolean>;

        const readAccess = {
            read: {[RESOURCE_KEYS.USER_MANAGEMENT.SYSTEM_ROLES]: true},
        } as unknown as ConsoleAccess;

        expect(hiddenCheck(abacFeatureFlagEnabled, {}, enterpriseAdvancedLicense, true, readAccess)).toBe(false);
        expect(hiddenCheck(abacFeatureFlagEnabled, {}, professionalLicense, true, readAccess)).toBe(true);
    });
});
