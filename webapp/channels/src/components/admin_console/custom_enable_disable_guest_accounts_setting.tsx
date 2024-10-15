// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import ConfirmModal from 'components/confirm_modal';

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

const CustomEnableDisableGuestAccountsSetting = ({
    id,
    value,
    onChange,
    cancelSubmit,
    disabled,
    setByEnv,
    showConfirm,
}: Props) => {
    const handleChange = useCallback((targetId: string, newValue: boolean, submit = false) => {
        const confirmNeeded = newValue === false; // Requires confirmation if disabling guest accounts
        let warning: React.ReactNode | string = '';
        if (confirmNeeded) {
            warning = (
                <FormattedMessage
                    id='admin.guest_access.disableConfirmWarning'
                    defaultMessage='All current guest account sessions will be revoked, and marked as inactive'
                />
            );
        }
        onChange(targetId, newValue, confirmNeeded, submit, warning);
    }, [onChange]);

    const handleConfirm = useCallback(() => {
        handleChange(id, false, true);
    }, [handleChange, id]);

    const label = (
        <FormattedMessage
            id='admin.guest_access.enableTitle'
            defaultMessage='Enable Guest Access: '
        />
    );

    const helpText = (
        <FormattedMessage
            id='admin.guest_access.helpText'
            defaultMessage='When true, external guest can be invited to channels within teams. Please see <a>Permissions Schemes</a> for which roles can invite guests.'
            values={{
                a: (chunks: string) => <Link to='/admin_console/user_management/permissions/system_scheme'>{chunks}</Link>,
            }}
        />
    );

    return (
        <>
            <BooleanSetting
                id={id}
                value={value}
                label={label}
                helpText={helpText}
                setByEnv={setByEnv}
                onChange={handleChange}
                disabled={disabled}
            />
            <ConfirmModal
                show={showConfirm && (value === false)}
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
                onConfirm={handleConfirm}
                onCancel={cancelSubmit}
            />
        </>
    );
};

export default CustomEnableDisableGuestAccountsSetting;
