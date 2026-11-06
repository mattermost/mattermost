// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientLicense} from '@mattermost/types/config';

import {RenderPermissionTypes} from 'mattermost-redux/action_types';
import {Permissions} from 'mattermost-redux/constants';
import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import store from 'stores/redux_store';

import AdminDefinition from './admin_definition';
import type {Check, ConsoleAccess} from './types';

const messageExportLicense = {IsLicensed: 'true', MessageExport: 'true'} as ClientLicense;
const noAccess = {read: {}, write: {}} as ConsoleAccess;
const complianceExportReader = {
    read: {[RESOURCE_KEYS.COMPLIANCE.COMPLIANCE_EXPORT]: true},
    write: {},
} as ConsoleAccess;

let generation = 0;
function setDelegatedPermissions(permissions: string[]) {
    store.dispatch({
        type: RenderPermissionTypes.RECEIVED_DELEGATED_PERMISSIONS,
        data: {permissions, generation: ++generation},
    });
}

function evaluate(check: Check | undefined, license: ClientLicense, consoleAccess: ConsoleAccess) {
    if (typeof check !== 'function') {
        return Boolean(check);
    }
    return check({}, {}, license, true, consoleAccess);
}

const isComplianceSectionHidden = (consoleAccess: ConsoleAccess) => evaluate(AdminDefinition.compliance.isHidden, messageExportLicense, consoleAccess);
const isComplianceExportHidden = (consoleAccess: ConsoleAccess, license = messageExportLicense) => evaluate(AdminDefinition.compliance.subsections.message_export.isHidden, license, consoleAccess);

describe('AdminDefinition - Compliance Export delegation', () => {
    afterEach(() => {
        setDelegatedPermissions([]);
    });

    test('is hidden from a user with neither the read permission nor a delegated permission', () => {
        expect(isComplianceSectionHidden(noAccess)).toBe(true);
        expect(isComplianceExportHidden(noAccess)).toBe(true);
    });

    test('is shown to a user with the read permission', () => {
        expect(isComplianceSectionHidden(complianceExportReader)).toBe(false);
        expect(isComplianceExportHidden(complianceExportReader)).toBe(false);
    });

    test('is shown to a delegate who may create compliance export jobs', () => {
        setDelegatedPermissions([Permissions.CREATE_COMPLIANCE_EXPORT_JOB]);

        expect(isComplianceSectionHidden(noAccess)).toBe(false);
        expect(isComplianceExportHidden(noAccess)).toBe(false);
    });

    test('is hidden from a delegate who holds other permissions of the action only', () => {
        setDelegatedPermissions([Permissions.READ_COMPLIANCE_EXPORT_JOB]);

        expect(isComplianceExportHidden(noAccess)).toBe(true);
    });

    test('is hidden from a delegate without a MessageExport license', () => {
        setDelegatedPermissions([Permissions.CREATE_COMPLIANCE_EXPORT_JOB]);

        expect(isComplianceExportHidden(noAccess, {IsLicensed: 'true', MessageExport: 'false'} as ClientLicense)).toBe(true);
    });

    test('a delegate does not see the other compliance pages', () => {
        setDelegatedPermissions([Permissions.CREATE_COMPLIANCE_EXPORT_JOB]);

        const fullLicense = {IsLicensed: 'true', DataRetention: 'true', Compliance: 'true', MessageExport: 'true'} as ClientLicense;
        const {data_retention: dataRetention, audits} = AdminDefinition.compliance.subsections;
        expect(evaluate(dataRetention.isHidden, fullLicense, noAccess)).toBe(true);
        expect(evaluate(audits.isHidden, fullLicense, noAccess)).toBe(true);
    });
});
