// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {getPersistentNotificationIntervalMinutes, getPersistentNotificationMaxRecipients} from 'mattermost-redux/selectors/entities/posts';

import Constants from 'utils/constants';
import {makeGetUserOrGroupMentionCountFromMessage} from 'utils/post_utils';

import {HasNoMentions, HasSpecialMentions} from './post_priority/error_messages';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';
import type {GlobalState} from 'types/store';

type Props = {
    currentChannelTeammateUsername?: UserProfile['username'];
    specialMentions: {[key: string]: boolean};
    channelType: Channel['type'];
    message: string;
    onConfirm: () => void;
    onExited: () => void;
};

function PersistNotificationConfirmModal({
    channelType,
    currentChannelTeammateUsername,
    specialMentions,
    message,
    onConfirm,
    onExited,
}: Props) {
    let body: React.ReactNode = '';
    let title: React.ReactNode = '';
    let confirmBtn: React.ReactNode = '';
    let handleConfirm = () => {};

    const getMentionCount = useMemo(makeGetUserOrGroupMentionCountFromMessage, []);
    const maxRecipients = useSelector(getPersistentNotificationMaxRecipients);
    const interval = useSelector(getPersistentNotificationIntervalMinutes);
    const count = useSelector((state: GlobalState) => getMentionCount(state, message));

    if (channelType === Constants.DM_CHANNEL) {
        handleConfirm = onConfirm;
        title = (
            <FormattedMessage
                id='persist_notification.dm_or_gm.title'
                defaultMessage='Send persistent notifications?'
            />
        );
        body = (
            <FormattedMessage
                id='persist_notification.dm_or_gm.description'
                defaultMessage='<b>{username}</b> will be notified every {interval, plural, one {1 minute} other {{interval} minutes}} until they’ve acknowledged the message.'
                values={{
                    interval,
                    username: currentChannelTeammateUsername,
                    b: (chunks: string) => <b>{chunks}</b>,
                }}
            />
        );
        confirmBtn = (
            <FormattedMessage
                id='persist_notification.dm_or_gm'
                defaultMessage='Send'
            />
        );
    } else if (Object.values(specialMentions).includes(true)) {
        body = (
            <HasSpecialMentions specialMentions={specialMentions}/>
        );
        confirmBtn = (
            <FormattedMessage
                id='persist_notification.special_mentions.confirm'
                defaultMessage='Got it'
            />
        );
    } else if (count === 0) {
        title = <HasNoMentions/>;
        body = (
            <FormattedMessage
                id='persist_notification.too_few.description'
                defaultMessage='There are no recipients mentioned in your message. You’ll need add mentions to be able to send persistent notifications.'
            />
        );
        confirmBtn = (
            <FormattedMessage
                id='persist_notification.too_few.confirm'
                defaultMessage='Got it'
            />
        );
    } else if (count > Number(maxRecipients)) {
        title = (
            <FormattedMessage
                id='persist_notification.too_many.title'
                defaultMessage='Too many recipients'
            />
        );
        body = (
            <FormattedMessage
                id='persist_notification.too_many.description'
                defaultMessage='You can send persistent notifications to a maximum of <b>{max}</b> recipients. There are <b>{count}</b> recipients mentioned in your message. You’ll need to change who you’ve mentioned before you can send.'
                values={{
                    max: maxRecipients,
                    count,
                    b: (chunks: string) => <b>{chunks}</b>,
                }}
            />
        );
        confirmBtn = (
            <FormattedMessage
                id='persist_notification.too_many.confirm'
                defaultMessage='Got it'
            />
        );
    } else {
        handleConfirm = onConfirm;
        title = (
            <FormattedMessage
                id='persist_notification.confirm.title'
                defaultMessage='Send persistent notifications?'
            />
        );
        body = (
            <FormattedMessage
                id='persist_notification.confirm.description'
                defaultMessage='Mentioned recipients will be notified every {interval, plural, one {1 minute} other {{interval} minutes}} until they’ve acknowledged the message.'
                values={{
                    interval,
                }}
            />
        );
        confirmBtn = (
            <FormattedMessage
                id='persist_notification.confirm'
                defaultMessage='Send'
            />
        );
    }

    return (
        <GenericModal
            autoFocusConfirmButton={true}
            id='persist_notification_confirm_modal'
            autoCloseOnConfirmButton={true}
            compassDesign={true}
            confirmButtonText={confirmBtn}
            enforceFocus={true}
            handleCancel={() => {}}
            handleConfirm={handleConfirm}
            handleEnterKeyPress={handleConfirm}
            isDeleteModal={false}
            modalHeaderText={title}
            onExited={onExited}
        >
            {body}
        </GenericModal>
    );
}

export default memo(PersistNotificationConfirmModal);
