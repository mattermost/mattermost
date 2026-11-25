// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientLicense} from '@mattermost/types/config';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import AdminDefinition from './admin_definition';
import type {AdminDefinitionSetting, AdminDefinitionSubSection, ConsoleAccess} from './types';

type Check = (config: object, state: object, license: ClientLicense | undefined, enterpriseReady: boolean, consoleAccess: ConsoleAccess) => boolean;

const SECURITY_FIX_ALERT_KEY = 'ServiceSettings.EnableSecurityFixAlert';

function settingsOf(subsection: AdminDefinitionSubSection): AdminDefinitionSetting[] {
    const schema = subsection.schema;

    return schema && 'settings' in schema && schema.settings ? schema.settings : [];
}

function settingKeysOf(subsection: AdminDefinitionSubSection) {
    return settingsOf(subsection).map((setting) => setting.key);
}

function getSetting() {
    return settingsOf(AdminDefinition.site.subsections.notices).find((setting) => setting.key === SECURITY_FIX_ALERT_KEY);
}

function writeAccessTo(resourceKey: string): ConsoleAccess {
    return {read: {[resourceKey]: true}, write: {[resourceKey]: true}};
}

describe('AdminDefinition - Check for Security and Release Updates setting', () => {
    const notRestricted = {ExperimentalSettings: {RestrictSystemAdmin: false}};
    const restricted = {ExperimentalSettings: {RestrictSystemAdmin: true}};

    test('is on the Site Configuration > Notices page, after the notice settings', () => {
        expect(settingKeysOf(AdminDefinition.site.subsections.notices)).toEqual([
            'AnnouncementSettings.AdminNoticesEnabled',
            'AnnouncementSettings.UserNoticesEnabled',
            SECURITY_FIX_ALERT_KEY,
        ]);
    });

    test('is no longer on the Environment > SMTP page', () => {
        expect(settingKeysOf(AdminDefinition.environment.subsections.smtp)).not.toContain(SECURITY_FIX_ALERT_KEY);
    });

    test('describes the security bulletins and the latest release check', () => {
        expect(getSetting()?.label).toMatchObject({defaultMessage: 'Check for Security and Release Updates: '});
        expect(getSetting()?.help_text).toMatchObject({
            defaultMessage: expect.stringMatching(/security bulletins[\s\S]*latest Mattermost release/),
        });
    });

    test('is writable with write access to Notices, not SMTP', () => {
        const isDisabled = getSetting()?.isDisabled as Check;

        expect(isDisabled(notRestricted, {}, undefined, true, writeAccessTo(RESOURCE_KEYS.SITE.NOTICES))).toBe(false);
        expect(isDisabled(notRestricted, {}, undefined, true, writeAccessTo(RESOURCE_KEYS.ENVIRONMENT.SMTP))).toBe(true);
    });

    test('is read-only when RestrictSystemAdmin is on', () => {
        const isDisabled = getSetting()?.isDisabled as Check;

        expect(isDisabled(restricted, {}, undefined, true, writeAccessTo(RESOURCE_KEYS.SITE.NOTICES))).toBe(true);
    });

    test('is hidden on Cloud', () => {
        const isHidden = getSetting()?.isHidden as Check;
        const access = writeAccessTo(RESOURCE_KEYS.SITE.NOTICES);

        expect(isHidden(notRestricted, {}, {IsLicensed: 'true', Cloud: 'true'} as ClientLicense, true, access)).toBe(true);
        expect(isHidden(notRestricted, {}, {IsLicensed: 'true', Cloud: 'false'} as ClientLicense, true, access)).toBe(false);
    });
});
