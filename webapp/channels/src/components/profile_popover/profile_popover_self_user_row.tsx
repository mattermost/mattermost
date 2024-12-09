// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {openModal} from 'actions/views/modals';

import UserSettingsModal from 'components/user_settings/modal';
import WithTooltip from 'components/with_tooltip';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    userId: string;
    currentUserId: string;
    haveOverrideProp: boolean;
    hide?: () => void;
    returnFocus: () => void;
    handleCloseModals: () => void;
    handleShowDirectChannel: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const ProfilePopoverSelfUserRow = ({
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

    return (
        <div
            className='user-popover__bottom-row-container'
        >
            <button
                type='button'
                className='btn btn-primary btn-sm'
                onClick={handleEditAccountSettings}
            >
                <i
                    className='icon icon-account-outline'
                    aria-hidden='true'
                />
                <FormattedMessage
                    id='user_profile.account.editProfile'
                    defaultMessage='Edit Profile'
                />
            </button>
            <WithTooltip
                title={formatMessage({id: 'user_profile.send.dm.yourself', defaultMessage: 'Send yourself a message'})}
            >
                <button
                    type='button'
                    className='btn btn-icon btn-sm'
                    onClick={handleShowDirectChannel}
                    aria-label={formatMessage({id: 'user_profile.send.dm.yourself', defaultMessage: 'Send yourself a message'})}
                >
                    <i
                        className='icon icon-send'
                        aria-hidden='true'
                    />
                </button>
            </WithTooltip>
        </div>
    );
};

export default ProfilePopoverSelfUserRow;
