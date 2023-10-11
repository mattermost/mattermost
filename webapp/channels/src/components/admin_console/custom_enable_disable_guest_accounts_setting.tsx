// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import BooleanSetting from './boolean_setting';

type Props = {
    id: string;
    value: boolean;
    onChange: (id: string, value: boolean, confirm?: boolean, doSubmit?: boolean, warning?: React.ReactNode | string) => void;
    cancelSubmit: () => void;
    disabled?: boolean;
    setByEnv: boolean;
    showConfirm: boolean;
}

export default class CustomEnableDisableGuestAccountsSetting extends React.PureComponent<Props> {
    public handleChange = (id: string, value: boolean, submit = false) => {
        const confirmNeeded = value === false; // Requires confirmation if disabling guest accounts
        let warning: React.ReactNode | string = '';
        if (confirmNeeded) {
            warning = (
                <FormattedMessage
                    id='admin.guest_access.disableConfirmWarning'
                    defaultMessage='All current guest account sessions will be revoked, and marked as inactive'
                />
            );
        }
        this.props.onChange(id, value, confirmNeeded, submit, warning);
    };

    public render() {
        const label = (
            <FormattedMessage
                id='admin.guest_access.enableTitle'
                defaultMessage='Enable Guest Access: '
            />
        );
        const helpText = (
            <FormattedMarkdownMessage
                id='admin.guest_access.enableDescription'
                defaultMessage='When true, external guest can be invited to channels within teams. Please see [Permissions Schemes](../user_management/permissions/system_scheme) for which roles can invite guests.'
            />
        );

        return (
            <>
                <BooleanSetting
                    id={this.props.id}
                    value={this.props.value}
                    label={label}
                    helpText={helpText}
                    setByEnv={this.props.setByEnv}
                    onChange={this.handleChange}
                    disabled={this.props.disabled}
                />
                <ConfirmModal
                    show={this.props.showConfirm && (this.props.value === false)}
                    title={
                        <FormattedMessage
                            id='admin.guest_access.disableConfirmTitle'
                            defaultMessage='Save and Disable Guest Access?'
                        />
                    }
                    message={
                        <FormattedMessage
                            id='admin.guest_access.disableConfirmMessage'
                            defaultMessage='Disabling guest access will revoke all current Guest Account sessions. Guests will no longer be able to login and new guests cannot be invited into Mattermost. Guest users will be marked as inactive in user lists. Enabling this feature will not reinstate previous guest accounts. Are you sure you wish to remove these users?'
                        />
                    }
                    confirmButtonText={
                        <FormattedMessage
                            id='admin.guest_access.disableConfirmButton'
                            defaultMessage='Save and Disable Guest Access'
                        />
                    }
                    onConfirm={() => {
                        this.handleChange(this.props.id, false, true);
                        this.setState({showConfirm: false});
                    }}
                    onCancel={this.props.cancelSubmit}
                />
            </>
        );
    }
}
