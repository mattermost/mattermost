// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AdminConfig, ClientLicense} from '@mattermost/types/config';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';

import AdminDefinition from './admin_definition';
import SchemaAdminSettings from './schema_admin_settings';
import type {AdminDefinitionSettingInput, AdminDefinitionSubSectionSchema, Check, ConsoleAccess} from './types';

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

    test('sections define title and description for AdminSectionPanel / AdminPanel chrome', () => {
        const subsection = AdminDefinition.system_attributes.subsections.attribute_based_access_control;
        const schema = subsection.schema;
        const sections = 'sections' in schema ? schema.sections ?? [] : [];

        expect(sections).toHaveLength(2);

        expect(sections[0].key).toBe('admin.accesscontrol.settings');
        expect((sections[0].title as {id: string}).id).toBe('admin.accesscontrol.sections.settings.title');
        expect((sections[0].description as {id: string}).id).toBe('admin.accesscontrol.sections.settings.description');

        expect(sections[1].key).toBe('admin.accesscontrol.session_attributes');
        expect((sections[1].title as {id: string}).id).toBe('admin.accesscontrol.session_attributes');
        expect((sections[1].description as {id: string}).id).toBe('admin.accesscontrol.sections.session_attributes.description');
    });

    test('renders Access Control and Session Attributes sections as AdminPanel', () => {
        mockedGetConfig.mockReturnValue({AuditLoggingActive: 'true'});

        const subsection = AdminDefinition.system_attributes.subsections.attribute_based_access_control;
        const schema = subsection.schema as AdminDefinitionSubSectionSchema;

        const {container} = renderWithContext(
            <SchemaAdminSettings
                cloud={{} as never}
                consoleAccess={consoleAccess}
                editRole={jest.fn()}
                enterpriseReady={true}
                isCurrentUserSystemAdmin={true}
                isDisabled={false}
                license={enterpriseAdvancedLicense}
                roles={{}}
                setNavigationBlocked={jest.fn()}
                config={{
                    AccessControlSettings: {
                        EnableAttributeBasedAccessControl: true,
                        EnableAccessControlAuditLogging: false,
                        EnableChannelPolicyIndicators: true,
                        TrustProxyDeviceIdentityHeader: false,
                        EnforceDeviceIDConsistency: false,
                    },
                    FeatureFlags: {
                        SessionAttributes: true,
                    },
                } as Partial<AdminConfig>}
                environmentConfig={{}}
                schema={schema}
                patchConfig={jest.fn()}
            />,
        );

        expect(screen.getByRole('heading', {name: 'Access Control'})).toBeInTheDocument();
        expect(screen.getByText('Enable attribute-based access control and related membership policy settings.')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Session Attributes'})).toBeInTheDocument();
        expect(screen.getByText('Configure how device identity is trusted and validated for session attributes.')).toBeInTheDocument();

        expect(container.querySelector('[data-testid="admin.accesscontrol.settings"].AdminPanel')).toBeInTheDocument();
        expect(container.querySelector('[data-testid="admin.accesscontrol.session_attributes"].AdminPanel')).toBeInTheDocument();
        expect(container.querySelectorAll('.AdminPanel.AdminSectionPanel')).toHaveLength(2);

        const sectionStack = container.querySelector('.admin-console__schema-sections');
        expect(sectionStack).toBeInTheDocument();
        expect(sectionStack?.querySelectorAll(':scope > .AdminPanel.AdminSectionPanel')).toHaveLength(2);
    });
});
