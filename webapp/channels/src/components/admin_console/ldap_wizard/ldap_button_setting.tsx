// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl, defineMessages} from 'react-intl';

import type {LdapDiagnosticResult, TestLdapFiltersResponse} from '@mattermost/types/admin';
import type {LdapSettings} from '@mattermost/types/config';

import type {GeneralSettingProps, LDAPDefinitionSettingButton} from './ldap_wizard';

import RequestButton from '../request_button/request_button';
import {descriptorOrStringToString, renderLabel, renderSettingHelpText} from '../schema_admin_settings';

type Props = {
    setting: LDAPDefinitionSettingButton;
    saveNeeded: boolean;
    disabled: boolean;
    ldapSettingsState: LdapSettings;
    onFilterTestResults?: (results: TestLdapFiltersResponse) => void;
} & GeneralSettingProps

const LDAPButtonSetting = (props: Props) => {
    const intl = useIntl();

    if (!props.schema || props.setting.type !== 'button') {
        return null;
    }

    const handleRequestAction = (success: () => void, error: (error: { message: string }) => void) => {
        if (!props.setting.skipSaveNeeded && props.saveNeeded !== false) {
            error({
                message: intl.formatMessage({id: 'admin_settings.save_unsaved_changes', defaultMessage: 'Please save unsaved changes first'}),
            });
            return;
        }
        const successCallback = (data?: LdapDiagnosticResult[]) => {
            // If this is the filter test button or attribute test button and we have results, pass them to the handler
            const isAttributeTest = props.setting.key === 'LdapSettings.TestAttributes';
            const isFiltersTest = props.setting.key === 'LdapSettings.TestFilters';
            const isGroupAttributeTest = props.setting.key === 'LdapSettings.TestGroupAttributes';

            if ((isFiltersTest || isAttributeTest || isGroupAttributeTest) && props.onFilterTestResults && data) {
                props.onFilterTestResults(data);

                const allTestsPassed = Array.isArray(data) && data.every((result) => result.error === '');
                if (allTestsPassed) {
                    success?.();
                } else {
                    const failedCount = data.filter((result) => result.error !== '').length;
                    const totalCount = data.length;

                    let messageKey;
                    if (isGroupAttributeTest) {
                        messageKey = ldapButtonMessages.testGroupAttributesPartialFailure;
                    } else if (isAttributeTest) {
                        messageKey = ldapButtonMessages.testAttributesPartialFailure;
                    } else {
                        messageKey = ldapButtonMessages.testFiltersPartialFailure;
                    }

                    error({
                        message: intl.formatMessage(messageKey, {failedCount, totalCount}),
                    });
                }
            } else {
                // For non-test buttons, show success normally
                success?.();
            }
        };

        props.setting.action(successCallback, error, props.ldapSettingsState);
    };

    const helpText = renderSettingHelpText(props.setting, props.schema, Boolean(props.disabled));
    const label = renderLabel(props.setting, props.schema, intl);

    return (
        <RequestButton
            id={props.setting.key}
            key={props.schema.id + '_text_' + props.setting.key}
            requestAction={handleRequestAction}
            helpText={helpText}
            loadingText={descriptorOrStringToString(props.setting.loading, intl)}
            buttonText={<span>{label}</span>}
            showSuccessMessage={Boolean(props.setting.success_message)}
            disabled={props.disabled}
            errorMessage={props.setting.error_message}
            successMessage={props.setting.success_message}
            flushLeft={true}
            buttonType={'primary'}
        />
    );
};

const ldapButtonMessages = defineMessages({
    testFiltersPartialFailure: {
        id: 'admin.ldap.testFiltersPartialFailure',
        defaultMessage: '{failedCount, number} of {totalCount, number} filter {totalCount, plural, one {test} other {tests}} failed. Check the highlighted fields for details.',
    },
    testAttributesPartialFailure: {
        id: 'admin.ldap.testAttributesPartialFailure',
        defaultMessage: '{failedCount, number} of {totalCount, number} attribute {totalCount, plural, one {test} other {tests}} failed. Check the highlighted fields for details.',
    },
    testGroupAttributesPartialFailure: {
        id: 'admin.ldap.testGroupAttributesPartialFailure',
        defaultMessage: '{failedCount, number} of {totalCount, number} group attribute {totalCount, plural, one {test} other {tests}} failed. Check the highlighted fields for details.',
    },
});

export default LDAPButtonSetting;
