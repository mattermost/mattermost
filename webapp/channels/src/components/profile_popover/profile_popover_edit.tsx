// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {AccountOutlineIcon, SendIcon} from '@mattermost/compass-icons/components';

import {openModal} from 'actions/views/modals';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import UserSettingsModal from 'components/user_settings/modal';

import Constants, {ModalIdentifiers} from 'utils/constants';

type Props = {
    userId: string;
    currentUserId: string;
    haveOverrideProp: boolean;
    hide?: () => void;
    returnFocus: () => void;
    handleCloseModals: () => void;
    handleShowDirectChannel: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const ProfilePopoverEdit = ({
    userId,
    currentUserId,
    haveOverrideProp,
    hide,
    returnFocus,
    handleCloseModals,
    handleShowDirectChannel,
}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const handleEditAccountSettings = useCallback(() => {
        hide?.();
        dispatch(openModal({
            modalId: ModalIdentifiers.USER_SETTINGS,
            dialogType: UserSettingsModal,
            dialogProps: {isContentProductSettings: false, onExited: returnFocus},
        }));
        handleCloseModals();
    }, [hide, returnFocus, handleCloseModals]);

    if (userId !== currentUserId || haveOverrideProp) {
        return null;
    }

    const sendMessageTooltip = (
        <Tooltip id='sendMessageTooltip'>
            <FormattedMessage
                id='user_profile.send.dm.yourself'
                defaultMessage='Send yourself a message'
            />
        </Tooltip>
    );

    return (
        <div
            data-toggle='tooltip'
            className='popover__row first'
        >
            <button
                id='editProfileButton'
                type='button'
                className='btn'
                onClick={handleEditAccountSettings}
            >
                <AccountOutlineIcon
                    size={16}
                    aria-label={formatMessage({
                        id: 'generic_icons.edit',
                        defaultMessage: 'Edit Icon',
                    })}
                />
                <FormattedMessage
                    id='user_profile.account.editProfile'
                    defaultMessage='Edit Profile'
                />
            </button>
            <OverlayTrigger
                delayShow={Constants.OVERLAY_TIME_DELAY}
                placement='top'
                overlay={sendMessageTooltip}
            >
                <button
                    type='button'
                    className='btn icon-btn'
                    onClick={handleShowDirectChannel}
                >
                    <SendIcon
                        size={18}
                        aria-label={formatMessage({
                            id: 'user_profile.send.dm.icon',
                            defaultMessage: 'Send Message Icon',
                        })}
                    />
                </button>
            </OverlayTrigger>
        </div>
    );
};

export default ProfilePopoverEdit;
