// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import CogOutlineIcon from '@mattermost/compass-icons/components/cog-outline';

import UserSettingsModal from 'components/user_settings/modal';
import WithTooltip from 'components/with_tooltip';

import {ModalIdentifiers} from 'utils/constants';

import type {ModalData} from 'types/actions';

type Props = {
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
    };
};

/**
 * SettingsButton renders a cog icon that opens the user settings modal.
 * - No active state (settings is a modal, not RHS panel)
 * - Connected via container (index.ts) to dispatch openModal action
 */
const SettingsButton = (props: Props): JSX.Element => {
    const {formatMessage} = useIntl();

    const handleClick = () => {
        props.actions.openModal({
            modalId: ModalIdentifiers.USER_SETTINGS,
            dialogType: UserSettingsModal,
            dialogProps: {
                isContentProductSettings: true,
                focusOriginElement: 'sidebar_settings_button',
            },
        });
    };

    return (
        <WithTooltip
            title={
                <FormattedMessage
                    id='global_header.productSettings'
                    defaultMessage='Settings'
                />
            }
            isVertical={false}
        >
            <button
                type="button"
                id="sidebar_settings_button"
                className="UtilityButton"
                onClick={handleClick}
                aria-haspopup="dialog"
                aria-label={formatMessage({id: 'global_header.productSettings', defaultMessage: 'Settings'})}
            >
                <CogOutlineIcon
                    size={20}
                    color="rgba(var(--sidebar-text-rgb), 0.64)"
                />
            </button>
        </WithTooltip>
    );
};

export default SettingsButton;
