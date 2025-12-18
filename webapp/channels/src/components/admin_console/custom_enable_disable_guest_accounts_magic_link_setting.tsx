// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

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

const CustomEnableDisableGuestAccountsMagicLinkSetting = ({
    id,
    value,
    onChange,
    cancelSubmit,
    disabled,
    setByEnv,
    showConfirm,
}: Props) => {
    const handleChange = useCallback((targetId: string, newValue: boolean, submit = false) => {
        const confirmNeeded = newValue === false; // Requires confirmation if disabling magic links
        let warning: React.ReactNode = '';
        if (confirmNeeded) {
            warning = (
                <FormattedMessage
                    id='admin.guest_access.disableMagicLinkConfirmWarning'
                    defaultMessage='All current guest magic link account sessions will be revoked, and marked as inactive'
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
            id='admin.guest_access.enableGuestMagicLinkTitle'
            defaultMessage='Enable passwordless authentication for guests using magic links via email: '
        />
    );

    const helpText = (
        <FormattedMessage
            id='admin.guest_access.enableGuestMagicLinkDescription'
            defaultMessage='When true, team admins can decide to invite guests that login via magic link. The invitation link will log them in without the need to configure a password. Future logins will also be done with a magic link sent to their email.'
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
                        id='admin.guest_access.disableMagicLinkConfirmTitle'
                        defaultMessage='Save and Disable Guest Magic Link Access?'
                    />
                }
                message={
                    <FormattedMessage
                        id='admin.guest_access.disableMagicLinkConfirmMessage'
                        defaultMessage='Disabling guest magic link access will revoke all current Guest Magic Link Account sessions. Those accounts will no longer be able to login and new guests cannot be invited into Mattermost as passwordless accounts. These accounts will be marked as inactive in user lists. Enabling this feature will not reinstate previous guest magic link accounts. Are you sure you wish to remove these users?'
                    />
                }
                confirmButtonText={
                    <FormattedMessage
                        id='admin.guest_access.disableMagicLinkConfirmButton'
                        defaultMessage='Save and Disable Guest Magic Link Access'
                    />
                }
                onConfirm={handleConfirm}
                onCancel={cancelSubmit}
            />
        </>
    );
};

export default CustomEnableDisableGuestAccountsMagicLinkSetting;
