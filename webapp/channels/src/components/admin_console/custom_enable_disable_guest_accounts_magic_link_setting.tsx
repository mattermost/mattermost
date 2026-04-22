// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {defineMessages, FormattedMessage} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';

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
    config: AdminConfig;
}

const messages = defineMessages({
    enableGuestMagicLinkTitle: {id: 'admin.guest_access.enableGuestMagicLinkTitle', defaultMessage: 'Enable passwordless authentication for guests using magic links via email: '},
    enableGuestMagicLinkDescription: {id: 'admin.guest_access.enableGuestMagicLinkDescription', defaultMessage: 'When true, invited guests can be allowed to login with a magic invitation link sent to their email address. The magic link will log them in without the need to configure a password. Future logins will also be done with a magic link sent to their email.'},
    disableMagicLinkConfirmTitle: {id: 'admin.guest_access.disableMagicLinkConfirmTitle', defaultMessage: 'Save and Disable Guest Magic Link Access?'},
    disableMagicLinkConfirmMessage: {id: 'admin.guest_access.disableMagicLinkConfirmMessage', defaultMessage: 'Disabling guest magic link access will revoke all current Guest Magic Link Account sessions. Those accounts will no longer be able to login and new guests cannot be invited into Mattermost as passwordless accounts. These accounts will be marked as inactive in user lists. Enabling this feature will not reinstate previous guest magic link accounts. Are you sure you wish to remove these users?'},
    disableMagicLinkConfirmWarning: {id: 'admin.guest_access.disableMagicLinkConfirmWarning', defaultMessage: 'All current guest magic link account sessions will be revoked, and marked as inactive'},
    disableMagicLinkConfirmButton: {id: 'admin.guest_access.disableMagicLinkConfirmButton', defaultMessage: 'Save and Disable Guest Magic Link Access'},
});

export const searchableStrings = [
    messages.enableGuestMagicLinkTitle,
    messages.enableGuestMagicLinkDescription,
];

const CustomEnableDisableGuestAccountsMagicLinkSetting = ({
    id,
    value,
    onChange,
    cancelSubmit,
    disabled,
    setByEnv,
    showConfirm,
    config,
}: Props) => {
    const enableGuestMagicLink = config.GuestAccountsSettings.EnableGuestMagicLink;
    const handleChange = useCallback((targetId: string, newValue: boolean, submit = false) => {
        const confirmNeeded = enableGuestMagicLink && (newValue === false); // Requires confirmation if disabling magic links
        let warning: React.ReactNode = '';
        if (confirmNeeded) {
            warning = (
                <FormattedMessage
                    {...messages.disableMagicLinkConfirmWarning}
                />
            );
        }
        onChange(targetId, newValue, confirmNeeded, submit, warning);
    }, [enableGuestMagicLink, onChange]);

    const handleConfirm = useCallback(() => {
        handleChange(id, false, true);
    }, [handleChange, id]);

    const memoizedTexts = useMemo(() => {
        return {
            title: <FormattedMessage {...messages.disableMagicLinkConfirmTitle}/>,
            message: <FormattedMessage {...messages.disableMagicLinkConfirmMessage}/>,
            confirmButtonText: <FormattedMessage {...messages.disableMagicLinkConfirmButton}/>,
            label: <FormattedMessage {...messages.enableGuestMagicLinkTitle}/>,
            helpText: <FormattedMessage {...messages.enableGuestMagicLinkDescription}/>,
        };
    }, []);

    return (
        <>
            <BooleanSetting
                id={id}
                value={value}
                label={memoizedTexts.label}
                helpText={memoizedTexts.helpText}
                setByEnv={setByEnv}
                onChange={handleChange}
                disabled={disabled}
            />
            <ConfirmModal
                show={showConfirm && (enableGuestMagicLink && value === false)}
                title={memoizedTexts.title}
                message={memoizedTexts.message}
                confirmButtonText={memoizedTexts.confirmButtonText}
                onConfirm={handleConfirm}
                onCancel={cancelSubmit}
            />
        </>
    );
};

export default CustomEnableDisableGuestAccountsMagicLinkSetting;
