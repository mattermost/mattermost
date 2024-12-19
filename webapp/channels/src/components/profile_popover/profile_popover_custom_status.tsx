// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';
import {CustomStatusDuration} from '@mattermost/types/users';

import {openModal} from 'actions/views/modals';
import {makeGetCustomStatus, isCustomStatusEnabled as getIsCustomStatusEnabled, isCustomStatusExpired as getIsCustomStatusExpired} from 'selectors/views/custom_status';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import CustomStatusModal from 'components/custom_status/custom_status_modal';
import CustomStatusText from 'components/custom_status/custom_status_text';
import ExpiryTime from 'components/custom_status/expiry_time';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

type Props = {
    user: UserProfile;
    currentUserId: string;
    hideStatus?: boolean;
    hide?: () => void;
    returnFocus?: () => void;
    currentUserTimezone?: string;
    haveOverrideProp: boolean;
}

const emojiStyles: React.CSSProperties = {
    marginRight: 8,
    width: 16,
    height: 16,
};
const ProfilePopoverCustomStatus = ({
    currentUserId,
    hideStatus,
    user,
    hide,
    returnFocus,
    currentUserTimezone,
    haveOverrideProp,
}: Props) => {
    const dispatch = useDispatch();
    const getCustomStatus = useMemo(makeGetCustomStatus, []);
    const customStatus = useSelector((state: GlobalState) => getCustomStatus(state, user.id));
    const isCustomStatusExpired = useSelector((state: GlobalState) => getIsCustomStatusExpired(state, customStatus));
    const isCustomStatusEnabled = useSelector((state: GlobalState) => getIsCustomStatusEnabled(state));

    const showCustomStatusModal = useCallback(() => {
        hide?.();
        const customStatusInputModalData = {
            modalId: ModalIdentifiers.CUSTOM_STATUS,
            dialogType: CustomStatusModal,
            dialogProps: {onExited: returnFocus},
        };
        dispatch(openModal(customStatusInputModalData));
    }, [hide, returnFocus]);

    const customStatusSet = (customStatus?.text || customStatus?.emoji) && !isCustomStatusExpired;
    const showExpiryTime = customStatusSet && customStatus.expires_at && customStatus.duration !== CustomStatusDuration.DONT_CLEAR;
    const canSetCustomStatus = user.id === currentUserId;
    const shouldShowCustomStatus = isCustomStatusEnabled && !haveOverrideProp && !hideStatus && (customStatusSet || canSetCustomStatus);

    if (!shouldShowCustomStatus) {
        return null;
    }

    let customStatusContent;
    if (customStatusSet) {
        customStatusContent = (
            <div
                className='user-popover__custom-status'
                aria-labelledby='user-popover__custom-status-title'
            >
                <CustomStatusEmoji
                    userID={user.id}
                    showTooltip={false}
                    emojiStyle={emojiStyles}
                />
                <CustomStatusText
                    text={customStatus.text || ''}
                />
            </div>
        );
    } else if (canSetCustomStatus) {
        customStatusContent = (
            <button
                className='btn btn-sm btn-quaternary user-popover__set-status'
                onClick={showCustomStatusModal}
            >
                <i className='icon icon-emoticon-plus-outline'/>
                <FormattedMessage
                    id='user_profile.custom_status.set_status'
                    defaultMessage='Set a status'
                />
            </button>
        );
    }

    return (
        <div
            id='user-popover-status'
            className='user-popover__time-status-container'
        >
            <strong
                id='user-popover__custom-status-title'
                className='user-popover__subtitle'
            >
                <FormattedMessage
                    id='user_profile.custom_status'
                    defaultMessage='Status'
                />
                {showExpiryTime && (
                    <ExpiryTime
                        time={customStatus.expires_at!} // has to be defined since showExpiryTime is true
                        timezone={currentUserTimezone}
                        withinBrackets={true}
                    />
                )}
            </strong>
            {customStatusContent}
        </div>
    );
};

export default ProfilePopoverCustomStatus;
